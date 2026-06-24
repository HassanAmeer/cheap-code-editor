from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_GITHUB_REPO = "castai/cheap"


class CheapAgentConfig(BaseSettings):
    """Validated config resolved from the host environment at agent construction time."""

    model_config = SettingsConfigDict(extra="ignore")

    binary_path: Path | None = Field(
        default=None,
        validation_alias="CHEAP_CODE_BINARY",
        description=(
            "Host path to a prebuilt linux cheap binary (e.g. dist/bin/cheap). "
            "The agent uploads the binary's grandparent directory so share/cheap/ auxiliary files travel with it. "
            "If unset, the latest GitHub release is fetched."
        ),
    )
    api_key: str = Field(
        validation_alias="CHEAP_API_KEY",
        description="Cheap LLM gateway API key forwarded to cheap at runtime.",
    )
    github_token: str | None = Field(
        default=None,
        validation_alias="GITHUB_TOKEN",
        description="Optional GitHub token used when fetching release assets; lifts the 60/hr anonymous rate limit.",
    )
    github_repo: str = DEFAULT_GITHUB_REPO

    @field_validator("binary_path", mode="before")
    @classmethod
    def _expand_path(cls, v: str | Path | None) -> Path | None:
        if v is None or v == "":
            return None
        return Path(v).expanduser().resolve()

    @field_validator("binary_path")
    @classmethod
    def _must_exist(cls, v: Path | None) -> Path | None:
        if v is not None and not v.is_file():
            raise ValueError(f"CHEAP_CODE_BINARY={v} does not exist or is not a regular file")
        return v

    @field_validator("api_key")
    @classmethod
    def _api_key_non_empty(cls, v: str) -> str:
        if not v:
            raise ValueError(
                "CHEAP_API_KEY is required to run cheap. "
                "Export it on the host and forward it with `harbor run --ae CHEAP_API_KEY=$CHEAP_API_KEY`."
            )
        return v
