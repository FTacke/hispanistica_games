"""Quiz game module for hispanistica_games.

Features:
- Topic-based quizzes with 10 questions (5 difficulty levels × 2 questions each)
- Player authentication (pseudonym + PIN or anonymous)
- 30-second timer per question
- 50:50 joker (2 per run)
- Leaderboard (last 15 games per topic)
- Resume/restart capability
"""

from .routes import blueprint as quiz_blueprint

__all__ = ["quiz_blueprint"]
