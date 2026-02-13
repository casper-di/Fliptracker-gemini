"""
FlipTracker NLP — Configuration
"""
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    # Use trained_models as the default model path base
    model_base: Path = Path(__file__).parent.parent / "trained_models"

    # Model paths
    ner_model_path: str = str(model_base / "ner_model" / "model-best")
    cls_carrier_path: str = str(model_base / "cls_carrier" / "model-best")
    cls_type_path: str = str(model_base / "cls_type" / "model-best")
    cls_marketplace_path: str = str(model_base / "cls_marketplace" / "model-best")
    cls_email_type_path: str = str(model_base / "cls_email_type" / "model-best")

    # Labels
    cls_carrier_labels_path: str = str(model_base / "cls_carrier" / "label_map.json")
    cls_type_labels_path: str = str(model_base / "cls_type" / "label_map.json")
    cls_marketplace_labels_path: str = str(model_base / "cls_marketplace" / "label_map.json")
    cls_email_type_labels_path: str = str(model_base / "cls_email_type" / "label_map.json")
    
    # Confidence thresholds
    ner_confidence_threshold: float = 0.5
    cls_confidence_threshold: float = 0.3
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Firebase (for runtime validation, optional)
    firebase_credentials_path: str = ""
    
    class Config:
        env_prefix = "NLP_"
        env_file = ".env"


settings = Settings()
