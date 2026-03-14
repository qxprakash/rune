#!/usr/bin/env python3
"""
Test script for model deregistration functionality.
"""

import requests
import time
import uuid
from typing import Dict, Any


def test_model_deregistration():
    """Test the model deregistration API endpoints."""
    base_url = "http://localhost:8000/api"

    print("🔧 Testing Model Deregistration API")
    print("=" * 50)

    print("\n1. Fetching available models...")
    try:
        response = requests.get(f"{base_url}/models")
        if response.status_code == 200:
            models_data = response.json()
            models = models_data["models"]
            print(f"✅ Found {len(models)} models in system")

            for model in models[:5]:  # Show first 5
                status = "Active" if model["is_active"] else "Inactive"
                print(f"  📦 {model['name']} - {status} (ID: {model['id'][:8]}...)")

            if len(models) == 0:
                print("❌ No models found. Create some models first to test deregistration.")
                return

        else:
            print(f"❌ Failed to fetch models: {response.status_code}")
            return

    except Exception as e:
        print(f"❌ Error fetching models: {e}")
        return

    # Test 2: Create a test model for deregistration
    print(f"\n2. Creating a test model for deregistration...")
    test_model_data = {
        "name": f"test-model-{int(time.time())}",
        "backend": "pytorch",
        "description": "Test model for deregistration API testing",
        "config": {"model_path": "distilgpt2", "device": "cpu"},
        "is_active": False  # Create as inactive for easier testing
    }

    try:
        response = requests.post(f"{base_url}/models", json=test_model_data)
        if response.status_code == 201:
            test_model = response.json()
            test_model_id = test_model["id"]
            print(f"✅ Created test model: {test_model['name']} (ID: {test_model_id[:8]}...)")
        else:
            print(f"❌ Failed to create test model: {response.status_code} - {response.text}")
            # Use existing model instead
            test_model_id = models[0]["id"]
            test_model = models[0]
            print(f"🔄 Using existing model: {test_model['name']} (ID: {test_model_id[:8]}...)")

    except Exception as e:
        print(f"❌ Error creating test model: {e}")
        return

    # Test 3: Try deregistration without force (should check for active jobs)
    print(f"\n3. Testing deregistration without force...")
    try:
        response = requests.delete(f"{base_url}/models/{test_model_id}/deregister")

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Deregistration successful: {result['message']}")
            print(f"   Cleanup details: {result['deregistration_details']}")
        elif response.status_code == 409:
            result = response.json()
            print(f"⚠️ Deregistration blocked (expected): {result['detail']['error']}")
            if 'details' in result['detail']:
                details = result['detail']['details']
                print(f"   Associated jobs: {details.get('total_associated_jobs', 0)}")
                print(f"   Job counts: {details.get('job_counts', {})}")
        else:
            print(f"❌ Unexpected response: {response.status_code} - {response.text}")

    except Exception as e:
        print(f"❌ Error testing deregistration: {e}")

    # Test 4: Try forced deregistration
    print(f"\n4. Testing forced deregistration...")
    try:
        response = requests.delete(f"{base_url}/models/{test_model_id}/deregister?force=true")

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Forced deregistration successful: {result['message']}")
            print(f"   Model name: {result['model_name']}")
            print(f"   Jobs affected: {result['deregistration_details'].get('jobs_affected', 0)}")
            print(f"   Cache cleared: {result['deregistration_details'].get('cache_cleared', False)}")

            # Verify model is gone
            verify_response = requests.get(f"{base_url}/models/{test_model_id}")
            if verify_response.status_code == 404:
                print("✅ Verified: Model successfully removed from database")
            else:
                print("❌ Warning: Model still exists in database")

        else:
            print(f"❌ Forced deregistration failed: {response.status_code} - {response.text}")

    except Exception as e:
        print(f"❌ Error testing forced deregistration: {e}")

    # Test 5: Test bulk deregistration
    print(f"\n5. Testing bulk deregistration...")

    # Get inactive models for bulk test
    inactive_models = [m for m in models if not m["is_active"]][:3]  # Test with up to 3

    if inactive_models:
        model_ids = [m["id"] for m in inactive_models]

        bulk_data = {
            "model_ids": model_ids,
            "force": True,
            "inactive_only": True
        }

        try:
            response = requests.post(f"{base_url}/models/deregister-bulk", json=bulk_data)

            if response.status_code == 200:
                result = response.json()
                print(f"✅ Bulk deregistration completed:")
                print(f"   Total requested: {result['total_requested']}")
                print(f"   Successful: {result['summary']['successful_count']}")
                print(f"   Failed: {result['summary']['failed_count']}")
                print(f"   Skipped: {result['summary']['skipped_count']}")
                print(f"   Success rate: {result['summary']['success_rate']}")

                # Show details for failed ones
                if result['failed']:
                    print("   Failed models:")
                    for failed in result['failed']:
                        print(f"     - {failed.get('model_name', failed['model_id'])}: {failed['error']}")

            else:
                print(f"❌ Bulk deregistration failed: {response.status_code} - {response.text}")

        except Exception as e:
            print(f"❌ Error testing bulk deregistration: {e}")
    else:
        print("⚠️ No inactive models found for bulk testing")

    print(f"\n🎉 Model deregistration testing completed!")


def test_deregistration_edge_cases():
    """Test edge cases for deregistration."""
    base_url = "http://localhost:8000/api"

    print("\n🔍 Testing Edge Cases")
    print("=" * 30)

    # Test invalid UUID
    print("Testing invalid UUID...")
    response = requests.delete(f"{base_url}/models/invalid-uuid/deregister")
    if response.status_code == 422:
        print("✅ Properly rejected invalid UUID")
    else:
        print(f"❌ Unexpected response for invalid UUID: {response.status_code}")

    # Test non-existent model
    print("Testing non-existent model...")
    fake_uuid = str(uuid.uuid4())
    response = requests.delete(f"{base_url}/models/{fake_uuid}/deregister")
    if response.status_code == 404:
        print("✅ Properly handled non-existent model")
    else:
        print(f"❌ Unexpected response for non-existent model: {response.status_code}")

    # Test bulk with empty list
    print("Testing bulk deregistration with empty list...")
    response = requests.post(f"{base_url}/models/deregister-bulk", json={"model_ids": []})
    if response.status_code == 400:
        print("✅ Properly rejected empty model list")
    else:
        print(f"❌ Unexpected response for empty list: {response.status_code}")


if __name__ == "__main__":
    print("🧪 Model Deregistration API Test Suite")
    print("=" * 60)

    print("\nMake sure the backend server is running at http://localhost:8000")
    input("Press Enter to start testing...")

    try:
        # Main deregistration tests
        test_model_deregistration()

        # Edge case tests
        test_deregistration_edge_cases()

        print("\n✅ All tests completed!")

    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
