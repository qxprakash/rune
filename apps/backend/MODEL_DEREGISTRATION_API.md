# Model Deregistration API Documentation

## Overview

The Model Deregistration API provides secure and comprehensive model removal functionality for the Rune AI platform. As a senior software engineer implementation, it includes proper validation, cleanup, and safety measures.

## Endpoints

### 1. Individual Model Deregistration

**Endpoint:** `DELETE /api/models/{model_id}/deregister`

**Description:** Completely removes a model from the system with proper validation and cleanup.

**Parameters:**
- `model_id` (path): UUID of the model to deregister
- `force` (query, optional): Boolean flag to force deregistration even with active jobs

**Response Codes:**
- `200 OK`: Successful deregistration
- `404 Not Found`: Model doesn't exist
- `409 Conflict`: Model has active jobs (use force=true to override)
- `500 Internal Server Error`: System error during deregistration

**Example Requests:**

```bash
# Basic deregistration (fails if model has active jobs)
curl -X DELETE "http://localhost:8000/api/models/123e4567-e89b-12d3-a456-426614174000/deregister"

# Forced deregistration (cancels active jobs)
curl -X DELETE "http://localhost:8000/api/models/123e4567-e89b-12d3-a456-426614174000/deregister?force=true"
```

**Success Response Example:**
```json
{
  "message": "Model 'my-model' deregistered successfully",
  "model_name": "my-model",
  "model_id": "123e4567-e89b-12d3-a456-426614174000",
  "deregistration_details": {
    "model_deleted": true,
    "jobs_affected": 5,
    "job_counts": {
      "completed": 3,
      "failed": 2
    },
    "cache_cleared": true
  },
  "forced": false
}
```

**Conflict Response Example (409):**
```json
{
  "detail": {
    "error": "Cannot deregister model with active jobs",
    "details": {
      "running_jobs": 2,
      "queued_jobs": 1,
      "total_associated_jobs": 10,
      "job_counts": {
        "running": 2,
        "queued": 1,
        "completed": 7
      },
      "suggestion": "Use force=True to deregister anyway or cancel running jobs first"
    },
    "model_name": "my-model"
  }
}
```

### 2. Bulk Model Deregistration

**Endpoint:** `POST /api/models/deregister-bulk`

**Description:** Deregister multiple models in a single operation with detailed results.

**Request Body:**
```json
{
  "model_ids": ["uuid1", "uuid2", "uuid3"],
  "force": false,
  "inactive_only": true
}
```

**Parameters:**
- `model_ids`: Array of model UUIDs to deregister
- `force`: Whether to force deregistration of models with active jobs
- `inactive_only`: Only deregister models that are already inactive

**Success Response Example:**
```json
{
  "successful": [
    {
      "model_id": "uuid1",
      "model_name": "model-1",
      "cleanup": {
        "model_deleted": true,
        "jobs_affected": 0,
        "cache_cleared": true
      }
    }
  ],
  "failed": [
    {
      "model_id": "uuid2",
      "model_name": "model-2",
      "error": "Cannot deregister model with active jobs"
    }
  ],
  "skipped": [
    {
      "model_id": "uuid3",
      "model_name": "model-3",
      "reason": "Model is active (use inactive_only=false to include)"
    }
  ],
  "total_requested": 3,
  "summary": {
    "successful_count": 1,
    "failed_count": 1,
    "skipped_count": 1,
    "success_rate": "33.3%"
  }
}
```

## Safety Features

### 1. Job Validation
- Checks for running/queued jobs before deregistration
- Provides detailed job status information
- Requires explicit `force=true` to override safety checks

### 2. Database Consistency
- Uses database transactions for atomic operations
- Automatic rollback on errors
- Maintains referential integrity

### 3. Cache Management
- Automatically clears model cache on successful deregistration
- Prevents memory leaks and stale model references

### 4. Detailed Logging
- Comprehensive audit trail of all deregistration operations
- Error logging with full context
- Performance metrics

## Cleanup Process

When a model is deregistered, the system performs:

1. **Validation Phase:**
   - Verify model exists
   - Check for active jobs
   - Validate permissions

2. **Job Cleanup Phase (if force=true):**
   - Cancel running jobs
   - Remove queued jobs
   - Update job status to "failed" with reason

3. **Model Removal Phase:**
   - Hard delete model record from database
   - Clear model from cache
   - Remove associated metadata

4. **Queue Cleanup Phase:**
   - Attempt to clear related jobs from Redis queue
   - Best-effort cleanup (non-blocking)

## Error Handling

### Common Error Scenarios:

1. **Model Not Found (404)**
   ```json
   {"detail": "Model with ID {model_id} not found"}
   ```

2. **Active Jobs Conflict (409)**
   - Detailed job information provided
   - Suggestion to use force or cancel jobs first

3. **System Error (500)**
   - Database transaction errors
   - Cache clearing failures
   - Unexpected exceptions

### Best Practices:

1. **Check Model Status First:**
   ```bash
   curl "http://localhost:8000/api/models/{model_id}"
   ```

2. **Cancel Active Jobs Before Deregistration:**
   ```bash
   curl -X DELETE "http://localhost:8000/api/jobs/{job_id}"
   ```

3. **Use Bulk Operations for Multiple Models:**
   - More efficient than individual calls
   - Better error handling and reporting
   - Atomic transaction per model

4. **Monitor Deregistration Results:**
   - Check cleanup details in response
   - Verify cache clearing success
   - Review affected job counts

## Integration Examples

### Python Integration:
```python
import requests

def deregister_model(model_id: str, force: bool = False) -> dict:
    """Deregister a model with proper error handling."""
    url = f"http://localhost:8000/api/models/{model_id}/deregister"
    params = {"force": force} if force else {}

    try:
        response = requests.delete(url, params=params)
        response.raise_for_status()
        return {"success": True, "data": response.json()}

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 409:
            return {"success": False, "conflict": e.response.json()}
        else:
            return {"success": False, "error": str(e)}
```

### JavaScript/TypeScript Integration:
```typescript
interface DeregistrationResult {
  success: boolean;
  data?: any;
  conflict?: any;
  error?: string;
}

async function deregisterModel(
  modelId: string,
  force: boolean = false
): Promise<DeregistrationResult> {
  const url = `http://localhost:8000/api/models/${modelId}/deregister`;
  const params = force ? '?force=true' : '';

  try {
    const response = await fetch(url + params, { method: 'DELETE' });

    if (response.status === 409) {
      return { success: false, conflict: await response.json() };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return { success: true, data: await response.json() };

  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

## Security Considerations

1. **Authentication Required:** All deregistration endpoints require proper authentication
2. **Authorization Checks:** Users can only deregister models they have permission to manage
3. **Audit Logging:** All deregistration attempts are logged for security auditing
4. **Rate Limiting:** Bulk operations are subject to rate limits to prevent abuse
5. **Input Validation:** All UUIDs and parameters are strictly validated

## Monitoring and Observability

The deregistration API provides extensive logging and metrics:

- **Operation Metrics:** Success rates, timing, affected resources
- **Error Tracking:** Detailed error categorization and frequency
- **Resource Impact:** Job cancellations, cache clearing, database operations
- **Performance Monitoring:** Response times, database query performance

This ensures full observability of model lifecycle management operations.
