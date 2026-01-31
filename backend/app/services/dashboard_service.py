"""
Dashboard Service for SAVE-IT.AI
Custom dashboards and widgets:
- User-configurable dashboards
- Widget library
- Real-time data widgets
- Sharing and templates
"""
import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey

from backend.app.core.database import Base

logger = logging.getLogger(__name__)


class WidgetType(Enum):
    """Available widget types."""
    GAUGE = "gauge"
    LINE_CHART = "line_chart"
    BAR_CHART = "bar_chart"
    PIE_CHART = "pie_chart"
    TABLE = "table"
    MAP = "map"
    ALARM_LIST = "alarm_list"
    DEVICE_STATUS = "device_status"
    KPI_CARD = "kpi_card"
    TEXT = "text"
    IMAGE = "image"
    HEATMAP = "heatmap"
    SCATTER = "scatter"


class Dashboard(Base):
    """Dashboard definition."""
    __tablename__ = "dashboards"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    is_default = Column(Integer, default=0)  # Default dashboard for user
    is_shared = Column(Integer, default=0)  # Shared with organization
    is_template = Column(Integer, default=0)  # Can be used as template

    # Layout configuration
    layout = Column(Text, nullable=True)  # JSON grid layout
    theme = Column(String(50), default="light")
    refresh_interval = Column(Integer, default=30)  # Seconds

    # Permissions
    can_edit_roles = Column(Text, nullable=True)  # JSON array of roles

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DashboardWidget(Base):
    """Widget on a dashboard."""
    __tablename__ = "dashboard_widgets"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True)

    widget_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=True)

    # Position and size in grid
    position_x = Column(Integer, default=0)
    position_y = Column(Integer, default=0)
    width = Column(Integer, default=4)
    height = Column(Integer, default=3)

    # Widget configuration
    config = Column(Text, nullable=True)  # JSON widget-specific config
    data_source = Column(Text, nullable=True)  # JSON data source configuration

    # Display options
    show_title = Column(Integer, default=1)
    show_border = Column(Integer, default=1)
    background_color = Column(String(20), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


@dataclass
class WidgetConfig:
    """Widget configuration."""
    widget_type: WidgetType
    title: Optional[str] = None
    position: tuple = (0, 0)
    size: tuple = (4, 3)
    config: Dict[str, Any] = None
    data_source: Dict[str, Any] = None


@dataclass
class WidgetData:
    """Data for rendering a widget."""
    widget_id: int
    widget_type: str
    title: Optional[str]
    data: Any
    last_updated: datetime
    error: Optional[str] = None


class DashboardService:
    """
    Dashboard management service.
    Handles dashboards, widgets, and data fetching.
    """

    # Widget type configurations
    WIDGET_CONFIGS = {
        WidgetType.GAUGE: {
            "min_width": 2,
            "min_height": 2,
            "supports_realtime": True,
            "data_type": "single_value"
        },
        WidgetType.LINE_CHART: {
            "min_width": 4,
            "min_height": 3,
            "supports_realtime": True,
            "data_type": "time_series"
        },
        WidgetType.BAR_CHART: {
            "min_width": 4,
            "min_height": 3,
            "supports_realtime": False,
            "data_type": "categorical"
        },
        WidgetType.TABLE: {
            "min_width": 4,
            "min_height": 3,
            "supports_realtime": True,
            "data_type": "tabular"
        },
        WidgetType.MAP: {
            "min_width": 6,
            "min_height": 4,
            "supports_realtime": True,
            "data_type": "geospatial"
        },
        WidgetType.ALARM_LIST: {
            "min_width": 4,
            "min_height": 3,
            "supports_realtime": True,
            "data_type": "alarm_list"
        },
        WidgetType.KPI_CARD: {
            "min_width": 2,
            "min_height": 2,
            "supports_realtime": True,
            "data_type": "kpi"
        }
    }

    def __init__(self, db: Session):
        self.db = db

    def create_dashboard(
        self,
        organization_id: int,
        owner_id: int,
        name: str,
        description: Optional[str] = None,
        is_default: bool = False,
        **kwargs
    ) -> Dashboard:
        """
        Create a new dashboard.

        Args:
            organization_id: Organization ID
            owner_id: User creating the dashboard
            name: Dashboard name
            description: Dashboard description
            is_default: Set as default dashboard

        Returns:
            Created Dashboard
        """
        # If setting as default, clear other defaults
        if is_default:
            self.db.query(Dashboard).filter(
                Dashboard.owner_id == owner_id,
                Dashboard.is_default == 1
            ).update({"is_default": 0})

        dashboard = Dashboard(
            organization_id=organization_id,
            owner_id=owner_id,
            name=name,
            description=description,
            is_default=1 if is_default else 0,
            **kwargs
        )

        self.db.add(dashboard)
        self.db.flush()

        logger.info(f"Created dashboard: {name} (ID: {dashboard.id})")

        return dashboard

    def update_dashboard(
        self,
        dashboard_id: int,
        user_id: int,
        **updates
    ) -> Optional[Dashboard]:
        """Update a dashboard."""
        dashboard = self.db.query(Dashboard).filter(
            Dashboard.id == dashboard_id
        ).first()

        if not dashboard:
            return None

        # Check permission
        if not self._can_edit(dashboard, user_id):
            raise PermissionError("User cannot edit this dashboard")

        for key, value in updates.items():
            if hasattr(dashboard, key) and key not in ['id', 'created_at', 'organization_id', 'owner_id']:
                if key in ['layout', 'can_edit_roles'] and value is not None:
                    value = json.dumps(value)
                setattr(dashboard, key, value)

        return dashboard

    def delete_dashboard(self, dashboard_id: int, user_id: int) -> bool:
        """Delete a dashboard."""
        dashboard = self.db.query(Dashboard).filter(
            Dashboard.id == dashboard_id
        ).first()

        if not dashboard:
            return False

        if dashboard.owner_id != user_id:
            raise PermissionError("Only owner can delete dashboard")

        # Widgets are cascade deleted
        self.db.delete(dashboard)
        return True

    def add_widget(
        self,
        dashboard_id: int,
        config: WidgetConfig
    ) -> DashboardWidget:
        """
        Add a widget to a dashboard.

        Args:
            dashboard_id: Dashboard ID
            config: Widget configuration

        Returns:
            Created DashboardWidget
        """
        widget = DashboardWidget(
            dashboard_id=dashboard_id,
            widget_type=config.widget_type.value,
            title=config.title,
            position_x=config.position[0],
            position_y=config.position[1],
            width=config.size[0],
            height=config.size[1],
            config=json.dumps(config.config) if config.config else None,
            data_source=json.dumps(config.data_source) if config.data_source else None
        )

        self.db.add(widget)
        self.db.flush()

        return widget

    def update_widget(
        self,
        widget_id: int,
        **updates
    ) -> Optional[DashboardWidget]:
        """Update a widget."""
        widget = self.db.query(DashboardWidget).filter(
            DashboardWidget.id == widget_id
        ).first()

        if not widget:
            return None

        for key, value in updates.items():
            if hasattr(widget, key) and key not in ['id', 'created_at', 'dashboard_id']:
                if key in ['config', 'data_source'] and value is not None:
                    value = json.dumps(value)
                setattr(widget, key, value)

        return widget

    def delete_widget(self, widget_id: int) -> bool:
        """Delete a widget."""
        widget = self.db.query(DashboardWidget).filter(
            DashboardWidget.id == widget_id
        ).first()

        if not widget:
            return False

        self.db.delete(widget)
        return True

    def get_widget_data(self, widget_id: int) -> WidgetData:
        """
        Fetch current data for a widget.

        Args:
            widget_id: Widget ID

        Returns:
            WidgetData with current values
        """
        widget = self.db.query(DashboardWidget).filter(
            DashboardWidget.id == widget_id
        ).first()

        if not widget:
            return WidgetData(
                widget_id=widget_id,
                widget_type="unknown",
                title=None,
                data=None,
                last_updated=datetime.utcnow(),
                error="Widget not found"
            )

        try:
            data_source = json.loads(widget.data_source) if widget.data_source else {}
            data = self._fetch_widget_data(widget.widget_type, data_source)

            return WidgetData(
                widget_id=widget_id,
                widget_type=widget.widget_type,
                title=widget.title,
                data=data,
                last_updated=datetime.utcnow()
            )
        except Exception as e:
            logger.error(f"Failed to fetch widget data {widget_id}: {e}")
            return WidgetData(
                widget_id=widget_id,
                widget_type=widget.widget_type,
                title=widget.title,
                data=None,
                last_updated=datetime.utcnow(),
                error=str(e)
            )

    def _fetch_widget_data(
        self,
        widget_type: str,
        data_source: Dict[str, Any]
    ) -> Any:
        """Fetch data based on widget type and data source."""
        if widget_type == WidgetType.GAUGE.value:
            return self._fetch_gauge_data(data_source)
        elif widget_type == WidgetType.LINE_CHART.value:
            return self._fetch_time_series_data(data_source)
        elif widget_type == WidgetType.ALARM_LIST.value:
            return self._fetch_alarm_data(data_source)
        elif widget_type == WidgetType.DEVICE_STATUS.value:
            return self._fetch_device_status_data(data_source)
        elif widget_type == WidgetType.KPI_CARD.value:
            return self._fetch_kpi_data(data_source)
        else:
            return None

    def _fetch_gauge_data(self, data_source: Dict) -> Dict:
        """Fetch single value for gauge widget."""
        device_id = data_source.get("device_id")
        datapoint = data_source.get("datapoint")

        if not device_id or not datapoint:
            return {"value": 0, "min": 0, "max": 100}

        from backend.app.models.devices import DeviceTelemetry

        latest = self.db.query(DeviceTelemetry).filter(
            DeviceTelemetry.device_id == device_id,
            DeviceTelemetry.datapoint_name == datapoint
        ).order_by(DeviceTelemetry.timestamp.desc()).first()

        return {
            "value": latest.value if latest else 0,
            "min": data_source.get("min", 0),
            "max": data_source.get("max", 100),
            "unit": data_source.get("unit", ""),
            "timestamp": latest.timestamp.isoformat() if latest else None
        }

    def _fetch_time_series_data(self, data_source: Dict) -> List[Dict]:
        """Fetch time series data for charts."""
        device_id = data_source.get("device_id")
        datapoints = data_source.get("datapoints", [])
        hours = data_source.get("hours", 24)

        if not device_id:
            return []

        from backend.app.models.devices import DeviceTelemetry
        from datetime import timedelta

        cutoff = datetime.utcnow() - timedelta(hours=hours)

        results = []
        for dp in datapoints:
            records = self.db.query(DeviceTelemetry).filter(
                DeviceTelemetry.device_id == device_id,
                DeviceTelemetry.datapoint_name == dp,
                DeviceTelemetry.timestamp >= cutoff
            ).order_by(DeviceTelemetry.timestamp.asc()).all()

            results.append({
                "datapoint": dp,
                "data": [
                    {"timestamp": r.timestamp.isoformat(), "value": r.value}
                    for r in records
                ]
            })

        return results

    def _fetch_alarm_data(self, data_source: Dict) -> List[Dict]:
        """Fetch alarm list data."""
        from backend.app.models.telemetry import DeviceAlarm, AlarmStatus

        limit = data_source.get("limit", 10)
        severities = data_source.get("severities", None)

        query = self.db.query(DeviceAlarm).filter(
            DeviceAlarm.status == AlarmStatus.TRIGGERED
        )

        if severities:
            query = query.filter(DeviceAlarm.severity.in_(severities))

        alarms = query.order_by(
            DeviceAlarm.triggered_at.desc()
        ).limit(limit).all()

        return [
            {
                "id": a.id,
                "device_id": a.device_id,
                "severity": a.severity,
                "message": a.message,
                "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None
            }
            for a in alarms
        ]

    def _fetch_device_status_data(self, data_source: Dict) -> Dict:
        """Fetch device status summary."""
        from backend.app.models.devices import Device

        site_id = data_source.get("site_id")

        query = self.db.query(Device).filter(Device.is_active == 1)

        if site_id:
            query = query.filter(Device.site_id == site_id)

        devices = query.all()

        online = sum(1 for d in devices if d.is_online == 1)
        offline = len(devices) - online

        return {
            "total": len(devices),
            "online": online,
            "offline": offline,
            "online_percent": round(online / len(devices) * 100, 1) if devices else 0
        }

    def _fetch_kpi_data(self, data_source: Dict) -> Dict:
        """Fetch KPI value."""
        kpi_id = data_source.get("kpi_id")

        if not kpi_id:
            return {"value": 0, "label": "N/A"}

        from backend.app.models.telemetry import KPIValue

        latest = self.db.query(KPIValue).filter(
            KPIValue.kpi_id == kpi_id
        ).order_by(KPIValue.calculated_at.desc()).first()

        return {
            "value": latest.value if latest else 0,
            "timestamp": latest.calculated_at.isoformat() if latest else None
        }

    def get_dashboards(
        self,
        organization_id: int,
        user_id: Optional[int] = None,
        include_shared: bool = True
    ) -> List[Dashboard]:
        """Get dashboards for user."""
        query = self.db.query(Dashboard).filter(
            Dashboard.organization_id == organization_id
        )

        if user_id:
            if include_shared:
                from sqlalchemy import or_
                query = query.filter(
                    or_(
                        Dashboard.owner_id == user_id,
                        Dashboard.is_shared == 1
                    )
                )
            else:
                query = query.filter(Dashboard.owner_id == user_id)

        return query.all()

    def get_dashboard_with_widgets(
        self,
        dashboard_id: int
    ) -> Optional[Dict[str, Any]]:
        """Get dashboard with all widgets and their configurations."""
        dashboard = self.db.query(Dashboard).filter(
            Dashboard.id == dashboard_id
        ).first()

        if not dashboard:
            return None

        widgets = self.db.query(DashboardWidget).filter(
            DashboardWidget.dashboard_id == dashboard_id
        ).all()

        return {
            "id": dashboard.id,
            "name": dashboard.name,
            "description": dashboard.description,
            "layout": json.loads(dashboard.layout) if dashboard.layout else None,
            "theme": dashboard.theme,
            "refresh_interval": dashboard.refresh_interval,
            "is_shared": dashboard.is_shared == 1,
            "widgets": [
                {
                    "id": w.id,
                    "type": w.widget_type,
                    "title": w.title,
                    "position": {"x": w.position_x, "y": w.position_y},
                    "size": {"width": w.width, "height": w.height},
                    "config": json.loads(w.config) if w.config else {},
                    "data_source": json.loads(w.data_source) if w.data_source else {}
                }
                for w in widgets
            ]
        }

    def clone_dashboard(
        self,
        dashboard_id: int,
        new_owner_id: int,
        new_name: Optional[str] = None
    ) -> Dashboard:
        """Clone a dashboard for another user."""
        original = self.get_dashboard_with_widgets(dashboard_id)
        if not original:
            raise ValueError("Dashboard not found")

        # Get organization from original dashboard
        orig_dashboard = self.db.query(Dashboard).filter(
            Dashboard.id == dashboard_id
        ).first()

        # Create new dashboard
        new_dashboard = self.create_dashboard(
            organization_id=orig_dashboard.organization_id,
            owner_id=new_owner_id,
            name=new_name or f"{original['name']} (Copy)",
            description=original['description'],
            layout=original['layout'],
            theme=original['theme'],
            refresh_interval=original['refresh_interval']
        )

        # Clone widgets
        for widget in original['widgets']:
            self.add_widget(
                dashboard_id=new_dashboard.id,
                config=WidgetConfig(
                    widget_type=WidgetType(widget['type']),
                    title=widget['title'],
                    position=(widget['position']['x'], widget['position']['y']),
                    size=(widget['size']['width'], widget['size']['height']),
                    config=widget['config'],
                    data_source=widget['data_source']
                )
            )

        return new_dashboard

    def _can_edit(self, dashboard: Dashboard, user_id: int) -> bool:
        """Check if user can edit dashboard."""
        if dashboard.owner_id == user_id:
            return True

        if dashboard.can_edit_roles:
            # Would check user roles here
            pass

        return False


def get_dashboard_service(db: Session) -> DashboardService:
    """Get DashboardService instance."""
    return DashboardService(db)
