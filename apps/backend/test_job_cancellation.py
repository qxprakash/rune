#!/usr/bin/env python3
"""
Test script for job cancellation functionality.
"""

import asyncio
import requests
import json
import time
from db.session import get_session
from db import ai_crud
from db.models import JobStatus, JobType


def test_api_endpoints():
    """Test the job cancellation API endpoints."""
    base_url = "http://localhost:8000/api"
    
    print("🔍 Testing Job Cancellation API Endpoints")
    print("=" * 50)
    
    # Test 1: Create a job to cancel
    print("\n1. Creating a test job...")
    job_data = {
        "prompt": "This is a test job for cancellation - write a very long essay about quantum physics",
        "task_type": "text_generation",
        "parameters": {"max_new_tokens": 1000}  # Make it take some time
    }
    
    try:
        response = requests.post(f"{base_url}/run/distilgpt2", json=job_data)
        if response.status_code == 200:
            job_info = response.json()
            job_id = job_info["job_id"]
            print(f"✅ Created job: {job_id}")
            
            # Test 2: Try to cancel the job
            print(f"\n2. Attempting to cancel job {job_id}...")
            time.sleep(1)  # Give it a moment to potentially start
            
            cancel_response = requests.delete(f"{base_url}/jobs/{job_id}")
            if cancel_response.status_code == 200:
                cancel_info = cancel_response.json()
                print(f"✅ Cancel response: {cancel_info['message']}")
            else:
                print(f"❌ Cancel failed: {cancel_response.status_code} - {cancel_response.text}")
                
        else:
            print(f"❌ Failed to create job: {response.status_code} - {response.text}")
            return
            
    except Exception as e:
        print(f"❌ Error testing job creation/cancellation: {e}")
        return
    
    # Test 3: Test bulk cancellation
    print(f"\n3. Testing bulk job cancellation...")
    try:
        # Create multiple jobs
        job_ids = []
        for i in range(3):
            job_data["prompt"] = f"Test job {i+1} for bulk cancellation"
            response = requests.post(f"{base_url}/run/distilgpt2", json=job_data)
            if response.status_code == 200:
                job_id = response.json()["job_id"]
                job_ids.append(job_id)
                print(f"  📝 Created job {i+1}: {job_id}")
        
        if job_ids:
            # Cancel all jobs
            print(f"\n  🚫 Cancelling all jobs...")
            bulk_cancel_response = requests.post(f"{base_url}/jobs/cancel-all")
            if bulk_cancel_response.status_code == 200:
                bulk_info = bulk_cancel_response.json()
                print(f"✅ Bulk cancel response: {bulk_info['message']}")
            else:
                print(f"❌ Bulk cancel failed: {bulk_cancel_response.status_code}")
                
    except Exception as e:
        print(f"❌ Error testing bulk cancellation: {e}")
    
    print(f"\n🎉 API endpoint testing completed!")


def check_database_status():
    """Check job statuses in the database."""
    print("\n🗄️ Checking Database Job Status")
    print("=" * 40)
    
    try:
        with next(get_session()) as db:
            # Get recent jobs
            recent_jobs = ai_crud.get_jobs(db, limit=10)
            
            status_counts = {}
            for job in recent_jobs:
                status = job.status.value if hasattr(job.status, 'value') else str(job.status)
                status_counts[status] = status_counts.get(status, 0) + 1
                
                if job.error_message and "cancelled" in job.error_message.lower():
                    print(f"🚫 Cancelled Job: {job.id}")
                    print(f"   Model: {job.model_name}")
                    print(f"   Error: {job.error_message}")
                    print()
            
            print("📊 Job Status Summary:")
            for status, count in status_counts.items():
                print(f"  {status}: {count}")
                
    except Exception as e:
        print(f"❌ Error checking database: {e}")


if __name__ == "__main__":
    print("🧪 Job Cancellation System Test")
    print("=" * 60)
    
    print("\nMake sure the backend server is running at http://localhost:8000")
    input("Press Enter to continue with testing...")
    
    # Test API endpoints
    test_api_endpoints()
    
    # Check database status
    check_database_status()
    
    print("\n✅ Testing completed!")
