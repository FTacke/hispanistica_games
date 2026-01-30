"""Quiz game module for hispanistica_games.

Features:
- Topic-based quizzes with 10 questions (5 difficulty levels × 2 questions each)
- Player authentication (pseudonym + PIN or anonymous)
- 30-second timer per question
- 50:50 joker (2 per run)
- Leaderboard (last 15 games per topic)
- Resume/restart capability
"""

__all__ = ["quiz_blueprint"]


def __getattr__(name: str):
	"""Lazy-load module attributes to avoid CLI circular imports."""
	if name == "quiz_blueprint":
		from .routes import blueprint as quiz_blueprint
		return quiz_blueprint
	raise AttributeError(f"module {__name__} has no attribute {name}")
