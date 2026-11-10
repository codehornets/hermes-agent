# Start/stop the Hermes gateway service from this checkout.
# Thin wrapper over scripts/hermes-service (same as `just service <action>`).
.PHONY: help start stop restart status logs

help:
	@echo "make start|stop|restart|status|logs   Hermes gateway service"

start stop restart status:
	@scripts/hermes-service $@

logs:
	@scripts/hermes-service logs
