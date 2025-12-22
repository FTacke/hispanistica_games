"""Game modules package for hispanistica_games.

Each game module (quiz, etc.) lives in its own subdirectory with:
- manifest.json: Module metadata and configuration
- models.py: SQLAlchemy models
- routes.py: Flask Blueprint with routes
- services.py: Business logic
- content/: YAML/JSON content files
"""
