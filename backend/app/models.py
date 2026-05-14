import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InstrumentSource(str, enum.Enum):
    csv_import = "csv_import"
    sample = "sample"
    fetch = "fetch"


class Instrument(Base):
    __tablename__ = "instruments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    source: Mapped[str] = mapped_column(String(32), default=InstrumentSource.csv_import.value)
    first_bar_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_bar_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bar_count: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    bars: Mapped[list["OHLCVBar"]] = relationship("OHLCVBar", back_populates="instrument", cascade="all, delete-orphan")


class OHLCVBar(Base):
    __tablename__ = "ohlcv_bars"
    __table_args__ = (UniqueConstraint("instrument_id", "bar_at", name="uq_instrument_bar_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instrument_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("instruments.id", ondelete="CASCADE"), index=True
    )
    bar_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    open: Mapped[float] = mapped_column(Numeric(20, 6))
    high: Mapped[float] = mapped_column(Numeric(20, 6))
    low: Mapped[float] = mapped_column(Numeric(20, 6))
    close: Mapped[float] = mapped_column(Numeric(20, 6))
    volume: Mapped[float] = mapped_column(Numeric(24, 4))

    instrument: Mapped["Instrument"] = relationship("Instrument", back_populates="bars")
