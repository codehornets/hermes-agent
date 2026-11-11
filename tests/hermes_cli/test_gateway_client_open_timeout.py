from hermes_cli import gateway_client as gc


def _load(monkeypatch, one_min, cpus):
    monkeypatch.setattr(gc.os, "getloadavg", lambda: (one_min, 0, 0))
    monkeypatch.setattr(gc.os, "cpu_count", lambda: cpus)


def test_idle_host_keeps_base_budget(monkeypatch):
    _load(monkeypatch, 1.0, 8)
    assert gc._open_timeout() == gc.OPEN_TIMEOUT_BASE


def test_oversubscribed_host_scales_budget(monkeypatch):
    _load(monkeypatch, 21.0, 8)
    assert gc._open_timeout() == 21.0 / 8 * gc.OPEN_TIMEOUT_BASE


def test_budget_is_capped(monkeypatch):
    _load(monkeypatch, 400.0, 8)
    assert gc._open_timeout() == gc.OPEN_TIMEOUT_MAX


def test_platform_without_loadavg_keeps_base(monkeypatch):
    monkeypatch.delattr(gc.os, "getloadavg", raising=False)
    assert gc._open_timeout() == gc.OPEN_TIMEOUT_BASE
