from typing import Literal

from pydantic import BaseModel, Field


class Voxel(BaseModel):
    x: int
    y: int
    z: int


class HoleSettings(BaseModel):
    enabled: bool
    size: float
    rim_sphere: bool = Field(alias="rimSphere")
    rim_radius: float = Field(alias="rimRadius")
    rim_offset: float = Field(alias="rimOffset")
    axes: list[Literal["x", "y", "z"]]

    model_config = {"populate_by_name": True}


class ExportPiece(BaseModel):
    id: str
    name: str | None = None
    voxels: list[Voxel]
    position: tuple[float, float, float]
    color: str | None = None


class ExportPayload(BaseModel):
    version: Literal[1]
    unit: float
    holes: HoleSettings
    pieces: list[ExportPiece]
    file_name: str | None = Field(default=None, alias="fileName")

    model_config = {"populate_by_name": True}
