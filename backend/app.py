"""Backend API entry point.

Define the HTTP endpoints the React frontend will call to submit player data,
request optimized positions and batting orders, and receive model results.
This module should handle API concerns such as request validation and CORS,
then delegate all decision logic to modules in ``model``.
"""
