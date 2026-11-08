from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    blender_bin: str = "blender"
    export_timeout_sec: int = 120
    cors_origins: str = "*"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False,
    )

    def cors_origin_list(self) -> list[str]:
        parts = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return parts or ["*"]
