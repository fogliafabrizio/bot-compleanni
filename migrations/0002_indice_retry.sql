-- Ricerca dei retry della giornata a ogni esecuzione oraria (research R-08).
CREATE INDEX idx_deliveries_retry ON deliveries(local_date, status);
