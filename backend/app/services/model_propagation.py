"""
Model Propagation Service for SAVE-IT.AI
Syncs changes from DeviceModels to all linked Device instances.
Implements Zoho IoT-style model-instance propagation.
"""
import logging
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from backend.app.models.devices import (
    DeviceModel, Device, Datapoint, Command, AlarmRule,
    DeviceDatapoint
)

logger = logging.getLogger(__name__)


class ModelPropagationService:
    """
    Propagates changes from DeviceModels to all linked Device instances.
    When a datapoint/command/alarm is added/updated/deleted on a model,
    all devices using that model are automatically updated.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def propagate_datapoint_add(self, datapoint: Datapoint) -> int:
        """
        When a new datapoint is added to a model, create DeviceDatapoint
        entries for all devices using that model.
        Returns count of devices updated.
        """
        if not datapoint.model_id:
            return 0
        
        model = self.db.query(DeviceModel).filter(
            DeviceModel.id == datapoint.model_id
        ).first()
        
        if not model or not model.auto_propagate:
            return 0
        
        devices = self.db.query(Device).filter(
            Device.model_id == datapoint.model_id,
            Device.is_active == 1
        ).all()
        
        count = 0
        for device in devices:
            existing = self.db.query(DeviceDatapoint).filter(
                DeviceDatapoint.device_id == device.id,
                DeviceDatapoint.datapoint_id == datapoint.id
            ).first()
            
            if not existing:
                device_dp = DeviceDatapoint(
                    device_id=device.id,
                    datapoint_id=datapoint.id,
                    quality="unknown",
                )
                self.db.add(device_dp)
                count += 1
        
        logger.info(f"Propagated datapoint {datapoint.name} to {count} devices")
        return count
    
    def propagate_datapoint_delete(self, datapoint_id: int) -> int:
        """
        When a datapoint is deleted from a model, remove corresponding
        DeviceDatapoint entries from all devices.
        Returns count of devices updated.
        """
        result = self.db.query(DeviceDatapoint).filter(
            DeviceDatapoint.datapoint_id == datapoint_id
        ).delete(synchronize_session=False)
        
        logger.info(f"Deleted datapoint {datapoint_id} from {result} devices")
        return result
    
    def propagate_datapoint_update(self, datapoint: Datapoint) -> int:
        """
        When a datapoint is updated on a model, the changes are automatically
        reflected in queries since DeviceDatapoint references the Datapoint.
        This method can be used for any additional update logic.
        Returns count of affected devices.
        """
        count = self.db.query(DeviceDatapoint).filter(
            DeviceDatapoint.datapoint_id == datapoint.id
        ).count()
        
        logger.info(f"Datapoint {datapoint.name} update affects {count} device instances")
        return count
    
    def propagate_model_to_device(self, device: Device) -> int:
        """
        Apply all datapoints from a model to a newly linked device.
        Called when device.model_id is set or changed.
        Returns count of datapoints added.
        """
        if not device.model_id:
            return 0
        
        datapoints = self.db.query(Datapoint).filter(
            Datapoint.model_id == device.model_id
        ).all()
        
        count = 0
        for dp in datapoints:
            existing = self.db.query(DeviceDatapoint).filter(
                DeviceDatapoint.device_id == device.id,
                DeviceDatapoint.datapoint_id == dp.id
            ).first()
            
            if not existing:
                device_dp = DeviceDatapoint(
                    device_id=device.id,
                    datapoint_id=dp.id,
                    quality="unknown",
                )
                self.db.add(device_dp)
                count += 1
        
        logger.info(f"Propagated {count} datapoints to device {device.id}")
        return count
    
    def sync_all_devices_for_model(self, model_id: int) -> int:
        """
        Ensure all devices using a model have all its datapoints.
        Useful for bulk sync or after model modifications.
        Returns total count of datapoints added.
        """
        devices = self.db.query(Device).filter(
            Device.model_id == model_id,
            Device.is_active == 1
        ).all()
        
        datapoints = self.db.query(Datapoint).filter(
            Datapoint.model_id == model_id
        ).all()
        
        total_added = 0
        for device in devices:
            existing_dp_ids = set(
                dp.datapoint_id for dp in 
                self.db.query(DeviceDatapoint).filter(
                    DeviceDatapoint.device_id == device.id
                ).all()
            )
            
            for dp in datapoints:
                if dp.id not in existing_dp_ids:
                    device_dp = DeviceDatapoint(
                        device_id=device.id,
                        datapoint_id=dp.id,
                        quality="unknown",
                    )
                    self.db.add(device_dp)
                    total_added += 1
        
        logger.info(f"Synced model {model_id}: added {total_added} datapoints to {len(devices)} devices")
        return total_added
    
    def get_model_stats(self, model_id: int) -> dict:
        """Get statistics for a device model."""
        device_count = self.db.query(Device).filter(
            Device.model_id == model_id,
            Device.is_active == 1
        ).count()
        
        datapoint_count = self.db.query(Datapoint).filter(
            Datapoint.model_id == model_id
        ).count()
        
        command_count = self.db.query(Command).filter(
            Command.model_id == model_id
        ).count()
        
        alarm_count = self.db.query(AlarmRule).filter(
            AlarmRule.model_id == model_id
        ).count()
        
        return {
            "device_count": device_count,
            "datapoint_count": datapoint_count,
            "command_count": command_count,
            "alarm_count": alarm_count,
        }
    
    def clone_model(
        self,
        source_model_id: int,
        new_name: str,
        new_version: str = "1.0.0",
    ) -> DeviceModel:
        """
        Clone a device model with all its datapoints, commands, and alarm rules.
        Returns the new model.
        """
        source = self.db.query(DeviceModel).filter(
            DeviceModel.id == source_model_id
        ).first()
        
        if not source:
            raise ValueError(f"Model {source_model_id} not found")
        
        new_model = DeviceModel(
            name=new_name,
            description=source.description,
            version=new_version,
            is_system_model=0,
            is_active=1,
            auto_propagate=source.auto_propagate,
            icon=source.icon,
            color=source.color,
        )
        self.db.add(new_model)
        self.db.flush()
        
        for dp in source.datapoints:
            new_dp = Datapoint(
                model_id=new_model.id,
                name=dp.name,
                display_name=dp.display_name,
                description=dp.description,
                data_type=dp.data_type,
                unit=dp.unit,
                aggregation=dp.aggregation,
                min_value=dp.min_value,
                max_value=dp.max_value,
                precision=dp.precision,
                scale_factor=dp.scale_factor,
                offset=dp.offset,
                is_readable=dp.is_readable,
                is_writable=dp.is_writable,
                is_required=dp.is_required,
                enum_values=dp.enum_values,
                default_value=dp.default_value,
                category=dp.category,
                display_order=dp.display_order,
                icon=dp.icon,
            )
            self.db.add(new_dp)
        
        for cmd in source.commands:
            new_cmd = Command(
                model_id=new_model.id,
                name=cmd.name,
                display_name=cmd.display_name,
                description=cmd.description,
                input_type=cmd.input_type,
                parameters_schema=cmd.parameters_schema,
                min_value=cmd.min_value,
                max_value=cmd.max_value,
                step=cmd.step,
                enum_options=cmd.enum_options,
                timeout_seconds=cmd.timeout_seconds,
                requires_confirmation=cmd.requires_confirmation,
                is_dangerous=cmd.is_dangerous,
                category=cmd.category,
                display_order=cmd.display_order,
                icon=cmd.icon,
            )
            self.db.add(new_cmd)
        
        for rule in source.alarm_rules:
            new_rule = AlarmRule(
                model_id=new_model.id,
                name=rule.name,
                description=rule.description,
                condition=rule.condition,
                threshold_value=rule.threshold_value,
                threshold_value_2=rule.threshold_value_2,
                duration_seconds=rule.duration_seconds,
                severity=rule.severity,
                is_active=rule.is_active,
                auto_clear=rule.auto_clear,
                notification_channels=rule.notification_channels,
                action_on_trigger=rule.action_on_trigger,
                action_on_clear=rule.action_on_clear,
            )
            self.db.add(new_rule)
        
        logger.info(f"Cloned model {source_model_id} to {new_model.id} ({new_name})")
        return new_model


def get_propagation_service(db: Session) -> ModelPropagationService:
    """Get model propagation service instance."""
    return ModelPropagationService(db)
