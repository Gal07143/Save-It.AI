"""
Dashboards API Router for SAVE-IT.AI
Endpoints for custom dashboards and widgets.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.services.dashboard_service import (
    DashboardService,
    WidgetConfig,
    WidgetType,
    get_dashboard_service,
)

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


class DashboardCreate(BaseModel):
    """Create dashboard request."""
    name: str
    description: Optional[str] = None
    is_default: bool = False
    theme: str = "light"
    refresh_interval: int = 30


class DashboardUpdate(BaseModel):
    """Update dashboard request."""
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    is_shared: Optional[bool] = None
    theme: Optional[str] = None
    refresh_interval: Optional[int] = None
    layout: Optional[dict] = None


class DashboardResponse(BaseModel):
    """Dashboard response."""
    id: int
    name: str
    description: Optional[str]
    is_default: bool
    is_shared: bool
    theme: str
    refresh_interval: int
    created_at: datetime

    class Config:
        from_attributes = True


class WidgetCreate(BaseModel):
    """Create widget request."""
    widget_type: str
    title: Optional[str] = None
    position_x: int = 0
    position_y: int = 0
    width: int = 4
    height: int = 3
    config: Optional[dict] = None
    data_source: Optional[dict] = None


class WidgetUpdate(BaseModel):
    """Update widget request."""
    title: Optional[str] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    config: Optional[dict] = None
    data_source: Optional[dict] = None


class WidgetResponse(BaseModel):
    """Widget response."""
    id: int
    dashboard_id: int
    widget_type: str
    title: Optional[str]
    position: dict
    size: dict
    config: Optional[dict]
    data_source: Optional[dict]

    class Config:
        from_attributes = True


class WidgetDataResponse(BaseModel):
    """Widget data response."""
    widget_id: int
    widget_type: str
    title: Optional[str]
    data: Optional[dict]
    last_updated: datetime
    error: Optional[str] = None


@router.post("", response_model=DashboardResponse)
def create_dashboard(
    request: DashboardCreate,
    db: Session = Depends(get_db),
    organization_id: int = 1,
    user_id: int = 1
):
    """Create a new dashboard."""
    service = get_dashboard_service(db)

    dashboard = service.create_dashboard(
        organization_id=organization_id,
        owner_id=user_id,
        name=request.name,
        description=request.description,
        is_default=request.is_default,
        theme=request.theme,
        refresh_interval=request.refresh_interval
    )

    db.commit()

    return DashboardResponse(
        id=dashboard.id,
        name=dashboard.name,
        description=dashboard.description,
        is_default=dashboard.is_default == 1,
        is_shared=dashboard.is_shared == 1,
        theme=dashboard.theme,
        refresh_interval=dashboard.refresh_interval,
        created_at=dashboard.created_at
    )


@router.get("", response_model=List[DashboardResponse])
def list_dashboards(
    include_shared: bool = True,
    db: Session = Depends(get_db),
    organization_id: int = 1,
    user_id: int = 1
):
    """List all dashboards."""
    service = get_dashboard_service(db)
    dashboards = service.get_dashboards(organization_id, user_id, include_shared)

    return [
        DashboardResponse(
            id=d.id,
            name=d.name,
            description=d.description,
            is_default=d.is_default == 1,
            is_shared=d.is_shared == 1,
            theme=d.theme,
            refresh_interval=d.refresh_interval,
            created_at=d.created_at
        )
        for d in dashboards
    ]


@router.get("/{dashboard_id}")
def get_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db)
):
    """Get dashboard with all widgets."""
    service = get_dashboard_service(db)
    dashboard = service.get_dashboard_with_widgets(dashboard_id)

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    return dashboard


@router.patch("/{dashboard_id}", response_model=DashboardResponse)
def update_dashboard(
    dashboard_id: int,
    request: DashboardUpdate,
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Update a dashboard."""
    service = get_dashboard_service(db)

    updates = request.model_dump(exclude_unset=True)

    try:
        dashboard = service.update_dashboard(dashboard_id, user_id, **updates)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    db.commit()

    return DashboardResponse(
        id=dashboard.id,
        name=dashboard.name,
        description=dashboard.description,
        is_default=dashboard.is_default == 1,
        is_shared=dashboard.is_shared == 1,
        theme=dashboard.theme,
        refresh_interval=dashboard.refresh_interval,
        created_at=dashboard.created_at
    )


@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: int,
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Delete a dashboard."""
    service = get_dashboard_service(db)

    try:
        if not service.delete_dashboard(dashboard_id, user_id):
            raise HTTPException(status_code=404, detail="Dashboard not found")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    db.commit()

    return {"message": "Dashboard deleted"}


@router.post("/{dashboard_id}/clone", response_model=DashboardResponse)
def clone_dashboard(
    dashboard_id: int,
    new_name: Optional[str] = None,
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Clone a dashboard."""
    service = get_dashboard_service(db)

    try:
        dashboard = service.clone_dashboard(dashboard_id, user_id, new_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    db.commit()

    return DashboardResponse(
        id=dashboard.id,
        name=dashboard.name,
        description=dashboard.description,
        is_default=dashboard.is_default == 1,
        is_shared=dashboard.is_shared == 1,
        theme=dashboard.theme,
        refresh_interval=dashboard.refresh_interval,
        created_at=dashboard.created_at
    )


# Widget endpoints
@router.post("/{dashboard_id}/widgets", response_model=WidgetResponse)
def add_widget(
    dashboard_id: int,
    request: WidgetCreate,
    db: Session = Depends(get_db)
):
    """Add a widget to a dashboard."""
    service = get_dashboard_service(db)

    try:
        widget_type = WidgetType(request.widget_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid widget type: {request.widget_type}")

    config = WidgetConfig(
        widget_type=widget_type,
        title=request.title,
        position=(request.position_x, request.position_y),
        size=(request.width, request.height),
        config=request.config,
        data_source=request.data_source
    )

    widget = service.add_widget(dashboard_id, config)

    db.commit()

    return WidgetResponse(
        id=widget.id,
        dashboard_id=widget.dashboard_id,
        widget_type=widget.widget_type,
        title=widget.title,
        position={"x": widget.position_x, "y": widget.position_y},
        size={"width": widget.width, "height": widget.height},
        config=request.config,
        data_source=request.data_source
    )


@router.patch("/widgets/{widget_id}", response_model=WidgetResponse)
def update_widget(
    widget_id: int,
    request: WidgetUpdate,
    db: Session = Depends(get_db)
):
    """Update a widget."""
    service = get_dashboard_service(db)

    updates = {}
    if request.title is not None:
        updates["title"] = request.title
    if request.position_x is not None:
        updates["position_x"] = request.position_x
    if request.position_y is not None:
        updates["position_y"] = request.position_y
    if request.width is not None:
        updates["width"] = request.width
    if request.height is not None:
        updates["height"] = request.height
    if request.config is not None:
        updates["config"] = request.config
    if request.data_source is not None:
        updates["data_source"] = request.data_source

    widget = service.update_widget(widget_id, **updates)

    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    db.commit()

    import json
    return WidgetResponse(
        id=widget.id,
        dashboard_id=widget.dashboard_id,
        widget_type=widget.widget_type,
        title=widget.title,
        position={"x": widget.position_x, "y": widget.position_y},
        size={"width": widget.width, "height": widget.height},
        config=json.loads(widget.config) if widget.config else None,
        data_source=json.loads(widget.data_source) if widget.data_source else None
    )


@router.delete("/widgets/{widget_id}")
def delete_widget(
    widget_id: int,
    db: Session = Depends(get_db)
):
    """Delete a widget."""
    service = get_dashboard_service(db)

    if not service.delete_widget(widget_id):
        raise HTTPException(status_code=404, detail="Widget not found")

    db.commit()

    return {"message": "Widget deleted"}


@router.get("/widgets/{widget_id}/data", response_model=WidgetDataResponse)
def get_widget_data(
    widget_id: int,
    db: Session = Depends(get_db)
):
    """Get current data for a widget."""
    service = get_dashboard_service(db)
    data = service.get_widget_data(widget_id)

    return WidgetDataResponse(
        widget_id=data.widget_id,
        widget_type=data.widget_type,
        title=data.title,
        data=data.data,
        last_updated=data.last_updated,
        error=data.error
    )
