"""Infrastructure router for monitoring and management endpoints."""
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from typing import Optional
from datetime import datetime
import uuid

router = APIRouter(prefix="/infrastructure", tags=["Infrastructure"])


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
    }


@router.get("/metrics")
async def get_metrics():
    """Get Prometheus-style metrics."""
    from app.services.metrics_service import metrics_registry
    return {"metrics": metrics_registry.to_prometheus()}


@router.get("/metrics/json")
async def get_metrics_json():
    """Get metrics in JSON format."""
    from app.services.metrics_service import metrics_registry
    return {
        "metrics": [
            {
                "name": m.name,
                "type": m.type.value,
                "value": m.value,
                "labels": m.labels,
            }
            for m in metrics_registry.collect_all()
        ]
    }


@router.get("/config")
async def get_config():
    """Get application configuration (non-sensitive)."""
    from app.services.config_service import config_service
    return {"config": config_service.export()}


@router.get("/feature-flags")
async def get_feature_flags():
    """Get feature flag status."""
    from app.services.config_service import feature_flags
    return {"flags": feature_flags.get_all()}


@router.post("/feature-flags/{flag}/enable")
async def enable_feature_flag(flag: str):
    """Enable a feature flag."""
    from app.services.config_service import feature_flags
    feature_flags.enable(flag)
    return {"flag": flag, "enabled": True}


@router.post("/feature-flags/{flag}/disable")
async def disable_feature_flag(flag: str):
    """Disable a feature flag."""
    from app.services.config_service import feature_flags
    feature_flags.disable(flag)
    return {"flag": flag, "enabled": False}


@router.get("/polling/status")
async def get_polling_status():
    """Get polling service status."""
    from app.services.polling_service import polling_service
    return polling_service.get_status()


@router.get("/scheduler/status")
async def get_scheduler_status():
    """Get scheduler status."""
    from app.services.scheduler_service import scheduler_service
    return scheduler_service.get_status()


@router.get("/websocket/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics."""
    from app.services.websocket_service import ws_manager
    return ws_manager.get_stats()


@router.get("/events/recent")
async def get_recent_events(event_type: Optional[str] = None, limit: int = 100):
    """Get recent events from event bus."""
    from app.services.event_bus import event_bus
    events = event_bus.get_recent_events(event_type, limit)
    return {
        "events": [
            {
                "type": e.type,
                "source": e.source,
                "timestamp": e.timestamp.isoformat(),
                "data": e.data,
            }
            for e in events
        ]
    }


@router.get("/events/stats")
async def get_event_stats():
    """Get event bus statistics."""
    from app.services.event_bus import event_bus
    return event_bus.get_stats()


@router.get("/traces/{trace_id}")
async def get_trace(trace_id: str):
    """Get a specific trace."""
    from app.services.tracing_service import tracing_service
    trace = tracing_service.export_trace(trace_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
    return trace


@router.get("/webhooks/deliveries")
async def get_webhook_deliveries(endpoint_id: Optional[str] = None, limit: int = 100):
    """Get webhook delivery history."""
    from app.services.webhook_service import webhook_service
    return {"deliveries": webhook_service.get_deliveries(endpoint_id=endpoint_id, limit=limit)}


@router.get("/webhooks/stats")
async def get_webhook_stats():
    """Get webhook service statistics."""
    from app.services.webhook_service import webhook_service
    return webhook_service.get_stats()


@router.get("/email/history")
async def get_email_history(limit: int = 100):
    """Get email send history."""
    from app.services.email_service import email_service
    return {"emails": email_service.get_history(limit=limit)}


@router.get("/email/stats")
async def get_email_stats():
    """Get email service statistics."""
    from app.services.email_service import email_service
    return email_service.get_stats()


@router.get("/storage/stats")
async def get_storage_stats():
    """Get storage service statistics."""
    from app.services.storage_service import storage_service
    return storage_service.get_stats()


@router.get("/backups")
async def get_backups(limit: int = 50):
    """Get backup history."""
    from app.services.backup_service import backup_service
    return {"backups": backup_service.get_backup_history(limit=limit)}


@router.post("/backups")
async def create_backup():
    """Create a new backup."""
    from app.services.backup_service import backup_service, BackupType
    job = await backup_service.create_backup(BackupType.FULL)
    return {
        "id": job.id,
        "status": job.status.value,
        "size_bytes": job.size_bytes,
    }


@router.post("/backups/{backup_id}/verify")
async def verify_backup(backup_id: str):
    """Verify a backup."""
    from app.services.backup_service import backup_service
    verified = await backup_service.verify_backup(backup_id)
    return {"backup_id": backup_id, "verified": verified}


@router.get("/retention-policy")
async def get_retention_policy():
    """Get data retention policy."""
    from app.services.backup_service import backup_service
    return backup_service.get_retention_policy()


@router.get("/security/scans")
async def get_security_scans(limit: int = 20):
    """Get security scan history."""
    from app.services.security_service import security_service
    return {"scans": security_service.get_scan_history(limit=limit)}


@router.post("/security/scan")
async def run_security_scan():
    """Run a security scan."""
    from app.services.security_service import security_service
    result = await security_service.scan_dependencies()
    return {
        "id": result.id,
        "summary": result.summary,
        "error": result.error,
    }


@router.get("/circuits")
async def get_circuit_breakers():
    """Get circuit breaker status."""
    from app.services.circuit_breaker import circuit_registry
    return {"circuits": circuit_registry.get_all_status()}


@router.post("/circuits/reset")
async def reset_circuit_breakers():
    """Reset all circuit breakers."""
    from app.services.circuit_breaker import circuit_registry
    circuit_registry.reset_all()
    return {"status": "reset"}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    """WebSocket endpoint for real-time updates."""
    from app.services.websocket_service import ws_manager
    
    connection_id = str(uuid.uuid4())
    
    try:
        await ws_manager.connect(websocket, connection_id)
        
        await websocket.send_json({
            "type": "connected",
            "connection_id": connection_id,
        })
        
        while True:
            data = await websocket.receive_json()
            
            if data.get("action") == "subscribe":
                channel = data.get("channel")
                if channel:
                    await ws_manager.subscribe(connection_id, channel)
                    await websocket.send_json({
                        "type": "subscribed",
                        "channel": channel,
                    })
            
            elif data.get("action") == "unsubscribe":
                channel = data.get("channel")
                if channel:
                    await ws_manager.unsubscribe(connection_id, channel)
                    await websocket.send_json({
                        "type": "unsubscribed",
                        "channel": channel,
                    })
            
            elif data.get("action") == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        await ws_manager.disconnect(connection_id)
    except Exception as e:
        await ws_manager.disconnect(connection_id)
