"""Flask routes for the Quiz game module.

Public routes (no webapp auth required):
- /games/quiz - Topic selection
- /games/quiz/<topic_id> - Topic entry (login/resume)
- /games/quiz/<topic_id>/play - Quiz gameplay

API routes:
- /api/quiz/topics - List active topics
- /api/quiz/topics/<topic_id>/leaderboard - Get leaderboard
- /api/quiz/auth/register - Register player
- /api/quiz/auth/login - Login player
- /api/quiz/auth/logout - Logout player
- /api/quiz/<topic_id>/run/start - Start or resume run
- /api/quiz/<topic_id>/run/restart - Restart run
- /api/quiz/run/current - Get current run state
- /api/quiz/run/<run_id>/question/start - Start question timer
- /api/quiz/run/<run_id>/answer - Submit answer
- /api/quiz/run/<run_id>/joker - Use joker
- /api/quiz/run/<run_id>/finish - Finish run
"""

from __future__ import annotations

import json
import logging
from functools import wraps
from typing import Optional, Callable, Any
import os
import time

from flask import (
    Blueprint,
    Response,
    jsonify,
    make_response,
    render_template,
    request,
    g,
)

from src.app.extensions.sqlalchemy_ext import get_session
from . import services
from .models import QuizPlayer

logger = logging.getLogger(__name__)


_quiz_debug_counter = 0


def _quiz_debug_enabled() -> bool:
    return os.environ.get("QUIZ_DEBUG", "0") in {"1", "true", "TRUE", "yes", "YES"}


def _quiz_debug_log(event: str, **fields: Any) -> None:
    global _quiz_debug_counter
    if not _quiz_debug_enabled():
        return
    _quiz_debug_counter += 1
    logger.info(
        "[quiz-debug:%s] %s %s",
        _quiz_debug_counter,
        event,
        {"ts_ms": int(time.time() * 1000), **{k: v for k, v in fields.items() if v is not None}},
    )

# Blueprint with dual prefix for pages and API
blueprint = Blueprint("quiz", __name__)

# Cookie name for game session token
QUIZ_SESSION_COOKIE = "quiz_session"


# ============================================================================
# Authentication Decorator
# ============================================================================

def quiz_auth_required(f: Callable) -> Callable:
    """Decorator to require quiz player authentication."""
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        token = request.cookies.get(QUIZ_SESSION_COOKIE)
        if not token:
            return jsonify({"error": "Authentication required", "code": "AUTH_REQUIRED"}), 401
        
        with get_session() as session:
            player = services.verify_session(session, token)
            if not player:
                return jsonify({"error": "Invalid or expired session", "code": "SESSION_INVALID"}), 401
            
            # Store player info in g for use in route
            g.quiz_player_id = player.id
            g.quiz_player_name = player.name
            g.quiz_player_anonymous = player.is_anonymous
        
        return f(*args, **kwargs)
    return decorated


def quiz_auth_optional(f: Callable) -> Callable:
    """Decorator to optionally load quiz player if authenticated."""
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        token = request.cookies.get(QUIZ_SESSION_COOKIE)
        g.quiz_player_id = None
        g.quiz_player_name = None
        g.quiz_player_anonymous = None
        
        if token:
            with get_session() as session:
                player = services.verify_session(session, token)
                if player:
                    g.quiz_player_id = player.id
                    g.quiz_player_name = player.name
                    g.quiz_player_anonymous = player.is_anonymous
        
        return f(*args, **kwargs)
    return decorated


# ============================================================================
# Page Routes (HTML)
# ============================================================================

# CANONICAL ROUTES: /quiz
@blueprint.route("/quiz")
@quiz_auth_optional
def quiz_index():
    """Quiz start page with topic selection (canonical: /quiz)."""
    return render_template(
        "games/quiz/index.html",
        page_name="quiz",
        player_name=g.quiz_player_name,
        player_authenticated=g.quiz_player_id is not None,
    )


@blueprint.route("/quiz/<topic_id>")
@quiz_auth_optional
def quiz_topic_entry(topic_id: str):
    """Topic entry page (canonical: /quiz/<topic_id>)."""
    with get_session() as session:
        topic = services.get_topic(session, topic_id)
        if not topic or not topic.is_active:
            return render_template("errors/404.html"), 404
        
        # Check for existing run if authenticated
        has_run = False
        if g.quiz_player_id:
            run = services.get_current_run(session, g.quiz_player_id, topic_id)
            has_run = run is not None
        
        return render_template(
            "games/quiz/topic_entry.html",
            page_name="quiz",
            topic_id=topic_id,
            topic_title_key=topic.title_key,
            player_name=g.quiz_player_name,
            player_authenticated=g.quiz_player_id is not None,
            has_existing_run=has_run,
        )


@blueprint.route("/quiz/<topic_id>/play")
@quiz_auth_required
def quiz_play(topic_id: str):
    """Quiz gameplay page (canonical: /quiz/<topic_id>/play)."""
    with get_session() as session:
        topic = services.get_topic(session, topic_id)
        if not topic or not topic.is_active:
            return render_template("errors/404.html"), 404
        
        return render_template(
            "games/quiz/play.html",
            page_name="quiz",
            topic_id=topic_id,
            topic_title_key=topic.title_key,
            player_name=g.quiz_player_name,
        )


# LEGACY REDIRECTS: /games/quiz/* → /quiz/*
@blueprint.route("/games/quiz")
def quiz_index_redirect():
    """Redirect /games/quiz to canonical /quiz."""
    from flask import redirect, url_for
    return redirect(url_for('quiz.quiz_index'), code=301)


@blueprint.route("/games/quiz/<topic_id>")
def quiz_topic_redirect(topic_id: str):
    """Redirect /games/quiz/<topic_id> to canonical /quiz/<topic_id>."""
    from flask import redirect, url_for
    return redirect(url_for('quiz.quiz_topic_entry', topic_id=topic_id), code=301)


@blueprint.route("/games/quiz/<topic_id>/play")
def quiz_play_redirect(topic_id: str):
    """Redirect /games/quiz/<topic_id>/play to canonical /quiz/<topic_id>/play."""
    from flask import redirect, url_for
    return redirect(url_for('quiz.quiz_play', topic_id=topic_id), code=301)


# ============================================================================
# API Routes - Public
# ============================================================================

@blueprint.route("/api/quiz/topics")
def api_get_topics():
    """Get list of active quiz topics."""
    with get_session() as session:
        topics = services.get_active_topics(session)
        return jsonify({
            "topics": [
                {
                    "topic_id": t.id,
                    "title_key": t.title_key,
                    "description_key": t.description_key,
                    "description": t.description_key or "",  # Expose description (may be plaintext or i18n key)
                    "authors": t.authors or [],  # New: expose authors list
                    "based_on": t.based_on,  # New: expose source reference
                    "href": f"/games/quiz/{t.id}",
                }
                for t in topics
            ]
        })


@blueprint.route("/api/quiz/topics/<topic_id>/leaderboard")
def api_get_leaderboard(topic_id: str):
    """Get leaderboard for a topic."""
    limit = request.args.get("limit", 15, type=int)
    limit = min(max(limit, 1), 50)  # Clamp to 1-50
    
    with get_session() as session:
        topic = services.get_topic(session, topic_id)
        if not topic:
            return jsonify({"error": "Topic not found"}), 404
        
        leaderboard = services.get_leaderboard(session, topic_id, limit)
        return jsonify({
            "topic_id": topic_id,
            "leaderboard": leaderboard,
        })


# ============================================================================
# API Routes - Authentication
# ============================================================================

@blueprint.route("/api/quiz/auth/register", methods=["POST"])
def api_register():
    """Register a new player or play anonymously."""
    data = request.get_json() or {}
    
    anonymous = data.get("anonymous", False)
    name = data.get("name", "").strip()
    pin = data.get("pin", "").strip()
    
    with get_session() as session:
        result = services.register_player(session, name, pin, anonymous)
        
        if not result.success:
            return jsonify({
                "error": result.error_message,
                "code": result.error_code,
            }), 400
        
        # Set session cookie
        response = make_response(jsonify({
            "success": True,
            "player_id": result.player_id,
            "player_name": result.player_name,
        }))
        
        response.set_cookie(
            QUIZ_SESSION_COOKIE,
            result.session_token,
            httponly=True,
            secure=request.is_secure,
            samesite="Lax",
            max_age=30 * 24 * 60 * 60,  # 30 days
        )
        
        return response


@blueprint.route("/api/quiz/auth/login", methods=["POST"])
def api_login():
    """Login existing player."""
    data = request.get_json() or {}
    
    name = data.get("name", "").strip()
    pin = data.get("pin", "").strip()
    
    if not name or not pin:
        return jsonify({
            "error": "Name and PIN required",
            "code": "MISSING_CREDENTIALS",
        }), 400
    
    with get_session() as session:
        result = services.login_player(session, name, pin)
        
        if not result.success:
            return jsonify({
                "error": result.error_message,
                "code": result.error_code,
            }), 401
        
        # Set session cookie
        response = make_response(jsonify({
            "success": True,
            "player_id": result.player_id,
            "player_name": result.player_name,
        }))
        
        response.set_cookie(
            QUIZ_SESSION_COOKIE,
            result.session_token,
            httponly=True,
            secure=request.is_secure,
            samesite="Lax",
            max_age=30 * 24 * 60 * 60,
        )
        
        return response


@blueprint.route("/api/quiz/auth/name-pin", methods=["POST"])
def api_auth_name_pin():
    """Unified auth: auto-create if new, login if existing, error if PIN mismatch.
    
    Request: {name, pin}
    
    Response:
    - 200: {status:"ok", user_id, player_name, is_new_user}
    - 400: Invalid input
    - 403: {status:"error", code:"PIN_MISMATCH", message:"..."}
    """
    data = request.get_json() or {}
    
    name = data.get("name", "").strip()
    pin = data.get("pin", "").strip()
    
    if not name or not pin:
        return jsonify({
            "status": "error",
            "code": "MISSING_CREDENTIALS",
            "message": "Name and PIN required",
        }), 400
    
    with get_session() as session:
        result = services.auth_name_pin(session, name, pin)
        
        if not result.success:
            status_code = 403 if result.error_code == "PIN_MISMATCH" else 400
            return jsonify({
                "status": "error",
                "code": result.error_code,
                "message": result.error_message,
            }), status_code
        
        # Set session cookie
        response = make_response(jsonify({
            "status": "ok",
            "user_id": result.player_id,
            "player_name": result.player_name,
            "is_new_user": result.is_new_user,
        }))
        
        response.set_cookie(
            QUIZ_SESSION_COOKIE,
            result.session_token,
            httponly=True,
            secure=request.is_secure,
            samesite="Lax",
            max_age=30 * 24 * 60 * 60,
        )
        
        return response


@blueprint.route("/api/quiz/auth/logout", methods=["POST"])
def api_logout():
    """Logout player (invalidate session)."""
    token = request.cookies.get(QUIZ_SESSION_COOKIE)
    
    if token:
        with get_session() as session:
            services.logout_player(session, token)
    
    response = make_response(jsonify({"success": True}))
    response.delete_cookie(QUIZ_SESSION_COOKIE)
    return response


@blueprint.route("/api/quiz/auth/session")
@quiz_auth_optional
def api_check_session():
    """Check current session status."""
    return jsonify({
        "authenticated": g.quiz_player_id is not None,
        "player_id": g.quiz_player_id,
        "player_name": g.quiz_player_name,
        "is_anonymous": g.quiz_player_anonymous,
    })


# ============================================================================
# API Routes - Run Lifecycle
# ============================================================================

@blueprint.route("/api/quiz/<topic_id>/run/start", methods=["POST"])
@quiz_auth_required
def api_start_run(topic_id: str):
    """Start a new run or resume existing one."""
    data = request.get_json() or {}
    force_new = data.get("force_new", False)

    _quiz_debug_log(
        "api_start_run",
        player_id=getattr(g, "quiz_player_id", None),
        topic_id=topic_id,
        force_new=force_new,
    )
    
    with get_session() as session:
        topic = services.get_topic(session, topic_id)
        if not topic or not topic.is_active:
            return jsonify({"error": "Topic not found", "code": "TOPIC_NOT_FOUND"}), 404
        
        run, is_new = services.start_run(session, g.quiz_player_id, topic_id, force_new)
        state = services.get_run_state(session, run)
        
        return jsonify({
            "success": True,
            "is_new": is_new,
            "run": {
                "run_id": state.run_id,
                "topic_id": state.topic_id,
                "status": state.status,
                "current_index": state.current_index,
                "run_questions": state.run_questions,
                "joker_remaining": state.joker_remaining,
                "joker_used_on": state.joker_used_on,
                "question_started_at_ms": state.question_started_at_ms,
                "deadline_at_ms": state.deadline_at_ms,
                "answers": state.answers,
            }
        })


@blueprint.route("/api/quiz/<topic_id>/run/restart", methods=["POST"])
@quiz_auth_required
def api_restart_run(topic_id: str):
    """Abandon current run and start new one."""
    with get_session() as session:
        topic = services.get_topic(session, topic_id)
        if not topic or not topic.is_active:
            return jsonify({"error": "Topic not found", "code": "TOPIC_NOT_FOUND"}), 404
        
        run = services.restart_run(session, g.quiz_player_id, topic_id)
        state = services.get_run_state(session, run)

        _quiz_debug_log(
            "api_restart_run",
            player_id=getattr(g, "quiz_player_id", None),
            topic_id=topic_id,
            run_id=state.run_id,
            current_index=state.current_index,
        )
        
        return jsonify({
            "success": True,
            "run": {
                "run_id": state.run_id,
                "topic_id": state.topic_id,
                "status": state.status,
                "current_index": state.current_index,
                "run_questions": state.run_questions,
                "joker_remaining": state.joker_remaining,
                "joker_used_on": state.joker_used_on,
                "question_started_at_ms": state.question_started_at_ms,
                "deadline_at_ms": state.deadline_at_ms,
                "answers": state.answers,
            }
        })


@blueprint.route("/api/quiz/run/current")
@quiz_auth_required
def api_get_current_run():
    """Get current run state for resume."""
    topic_id = request.args.get("topic_id")
    if not topic_id:
        return jsonify({"error": "topic_id required", "code": "MISSING_TOPIC"}), 400
    
    with get_session() as session:
        run = services.get_current_run(session, g.quiz_player_id, topic_id)
        
        if not run:
            return jsonify({
                "has_run": False,
                "run": None,
            })
        
        state = services.get_run_state(session, run)
        
        return jsonify({
            "has_run": True,
            "run": {
                "run_id": state.run_id,
                "topic_id": state.topic_id,
                "status": state.status,
                "current_index": state.current_index,
                "run_questions": state.run_questions,
                "joker_remaining": state.joker_remaining,
                "joker_used_on": state.joker_used_on,
                "question_started_at_ms": state.question_started_at_ms,
                "deadline_at_ms": state.deadline_at_ms,
                "answers": state.answers,
            }
        })


# ============================================================================
# API Routes - Question Interaction
# ============================================================================

@blueprint.route("/api/quiz/run/<run_id>/question/start", methods=["POST"])
@quiz_auth_required
def api_start_question(run_id: str):
    """Start timer for a question."""
    data = request.get_json() or {}
    question_index = data.get("question_index")
    started_at_ms = data.get("started_at_ms")
    
    if question_index is None or started_at_ms is None:
        return jsonify({"error": "question_index and started_at_ms required"}), 400
    
    with get_session() as session:
        from .models import QuizRun
        from sqlalchemy import select, and_
        
        stmt = select(QuizRun).where(
            and_(
                QuizRun.id == run_id,
                QuizRun.player_id == g.quiz_player_id
            )
        )
        run = session.execute(stmt).scalar_one_or_none()
        
        if not run:
            return jsonify({"error": "Run not found", "code": "RUN_NOT_FOUND"}), 404
        
        success = services.start_question(session, run, question_index, started_at_ms)
        
        return jsonify({
            "success": success,
            "question_started_at_ms": run.question_started_at_ms,
            "deadline_at_ms": run.deadline_at_ms,
        })


@blueprint.route("/api/quiz/run/<run_id>/answer", methods=["POST"])
@quiz_auth_required
def api_submit_answer(run_id: str):
    """Submit answer for current question."""
    data = request.get_json() or {}
    question_index = data.get("question_index")
    selected_answer_id = data.get("selected_answer_id")  # Can be None for timeout
    answered_at_ms = data.get("answered_at_ms")
    used_joker = data.get("used_joker", False)

    _quiz_debug_log(
        "api_submit_answer.request",
        run_id=run_id,
        player_id=getattr(g, "quiz_player_id", None),
        question_index=question_index,
        selected_answer_id=selected_answer_id,
        answered_at_ms=answered_at_ms,
        used_joker=used_joker,
    )
    
    if question_index is None or answered_at_ms is None:
        return jsonify({"error": "question_index and answered_at_ms required"}), 400
    
    with get_session() as session:
        from .models import QuizRun
        from sqlalchemy import select, and_
        
        stmt = select(QuizRun).where(
            and_(
                QuizRun.id == run_id,
                QuizRun.player_id == g.quiz_player_id
            )
        )
        run = session.execute(stmt).scalar_one_or_none()
        
        if not run:
            return jsonify({"error": "Run not found", "code": "RUN_NOT_FOUND"}), 404
        
        result = services.submit_answer(
            session, run, question_index, selected_answer_id, answered_at_ms, used_joker
        )
        
        if not result.success:
            return jsonify({
                "error": result.error_message,
                "code": result.error_code,
            }), 400
        
        return jsonify({
            "success": True,
            "result": result.result,
            "is_correct": result.result == "correct",
            "correct_option_id": result.correct_option_id,
            "explanation_key": result.explanation_key,
            "next_question_index": result.next_question_index,
            "finished": result.finished,
            "is_run_finished": result.finished,  # Explicit naming for frontend
            "joker_remaining": result.joker_remaining,
            # Scoring fields - source of truth for live score
            "earned_points": result.earned_points,
            "running_score": result.running_score,  # INCLUDES bonus if level_completed && level_perfect
            "level_completed": result.level_completed,
            "level_perfect": result.level_perfect,
            "level_bonus": result.level_bonus,  # The bonus amount (0 if not perfect)
            "bonus_applied_now": result.level_completed and result.level_perfect and result.level_bonus > 0,  # True if bonus is in running_score
            "difficulty": result.difficulty,
            "level_correct_count": result.level_correct_count,
            "level_questions_in_level": result.level_questions_in_level,
        })


@blueprint.route("/api/quiz/run/<run_id>/status", methods=["GET"])
@quiz_auth_required
def api_get_run_status(run_id: str):
    """Get current run status including running score (for page refresh)."""
    with get_session() as session:
        from .models import QuizRun, QuizRunAnswer
        from sqlalchemy import select, and_

        _quiz_debug_log(
            "api_get_run_status.request",
            run_id=run_id,
            player_id=getattr(g, "quiz_player_id", None),
        )

        stmt = select(QuizRun).where(
            and_(
                QuizRun.id == run_id,
                QuizRun.player_id == g.quiz_player_id,
            )
        )
        run = session.execute(stmt).scalar_one_or_none()

        if not run:
            return jsonify({"error": "Run not found", "code": "RUN_NOT_FOUND"}), 404

        # Calculate current score using same logic as answer endpoint
        stmt_answers = select(QuizRunAnswer).where(
            QuizRunAnswer.run_id == run.id
        ).order_by(QuizRunAnswer.question_index)
        answers = list(session.execute(stmt_answers).scalars().all())

        from .services import calculate_running_score, QUESTIONS_PER_RUN

        running_score = 0
        level_completed = False
        level_perfect = False
        level_bonus = 0
        level_correct_count = 0
        level_questions_in_level = 0
        bonus_applied_now = False
        last_answer_result = None

        if answers:
            last_answer = answers[-1]
            last_answer_result = last_answer.result
            running_score, level_completed, level_perfect, level_bonus, level_correct_count, level_questions_in_level = calculate_running_score(
                session, run, last_answer.question_index, last_answer.result
            )
            bonus_applied_now = level_completed and level_perfect and level_bonus > 0

        # Use run.current_index as the canonical progress counter
        current_index = run.current_index
        is_run_finished = (run.status != "in_progress") or (current_index >= QUESTIONS_PER_RUN)

        payload = {
            "run_id": run.id,
            "topic_id": run.topic_id,
            "status": run.status,
            "current_index": current_index,
            "running_score": running_score,
            "next_question_index": (current_index if not is_run_finished else None),
            "finished": is_run_finished,
            "is_run_finished": is_run_finished,
            "joker_remaining": run.joker_remaining,
            # Level info (best-effort, derived from last answered question)
            "level_completed": level_completed,
            "level_perfect": level_perfect,
            "level_bonus": level_bonus,
            "bonus_applied_now": bonus_applied_now,
            "last_answer_result": last_answer_result,
            "level_correct_count": level_correct_count,
            "level_questions_in_level": level_questions_in_level,
        }

        _quiz_debug_log(
            "api_get_run_status.response",
            run_id=run.id,
            player_id=getattr(g, "quiz_player_id", None),
            current_index=current_index,
            running_score=running_score,
            finished=is_run_finished,
            level_completed=level_completed,
            level_perfect=level_perfect,
            level_bonus=level_bonus,
        )

        return jsonify(payload)


@blueprint.route("/api/quiz/run/<run_id>/joker", methods=["POST"])
@quiz_auth_required
def api_use_joker(run_id: str):
    """Use 50:50 joker on current question."""
    data = request.get_json() or {}
    question_index = data.get("question_index")
    
    if question_index is None:
        return jsonify({"error": "question_index required"}), 400
    
    with get_session() as session:
        from .models import QuizRun
        from sqlalchemy import select, and_
        
        stmt = select(QuizRun).where(
            and_(
                QuizRun.id == run_id,
                QuizRun.player_id == g.quiz_player_id
            )
        )
        run = session.execute(stmt).scalar_one_or_none()
        
        if not run:
            return jsonify({"error": "Run not found", "code": "RUN_NOT_FOUND"}), 404
        
        success, disabled_ids, error_code = services.use_joker(session, run, question_index)
        
        if not success:
            error_messages = {
                "LIMIT_REACHED": "50/50 limit reached (max 2 per run)",
                "INVALID_INDEX": "Cannot use joker on this question",
                "QUESTION_NOT_FOUND": "Question not found",
                "NOT_ENOUGH_OPTIONS": "Question has too few options for 50/50",
            }
            return jsonify({
                "success": False,
                "error": error_messages.get(error_code, "Cannot use joker"),
                "code": error_code or "JOKER_UNAVAILABLE",
            }), 400
        
        return jsonify({
            "success": True,
            "disabled_answer_ids": disabled_ids,
            "hidden_option_ids": disabled_ids,  # Alias for spec compliance
            "fifty_fifty_used_count": 2 - run.joker_remaining,
            "fifty_fifty_remaining": run.joker_remaining,
            "joker_remaining": run.joker_remaining,
        })


@blueprint.route("/api/quiz/run/<run_id>/finish", methods=["POST"])
@quiz_auth_required
def api_finish_run(run_id: str):
    """Finish run and get final score with highscore rank."""
    with get_session() as session:
        from .models import QuizRun
        from sqlalchemy import select, and_
        
        stmt = select(QuizRun).where(
            and_(
                QuizRun.id == run_id,
                QuizRun.player_id == g.quiz_player_id
            )
        )
        run = session.execute(stmt).scalar_one_or_none()
        
        if not run:
            return jsonify({"error": "Run not found", "code": "RUN_NOT_FOUND"}), 404
        
        if run.status != "in_progress":
            return jsonify({"error": "Run already finished", "code": "RUN_FINISHED"}), 400
        
        result = services.finish_run(session, run)
        
        # Get leaderboard to determine player's rank
        leaderboard = services.get_leaderboard(session, run.topic_id)
        player_rank = None
        leaderboard_size = len(leaderboard)
        
        # Find player's position in leaderboard
        for entry in leaderboard:
            if entry["total_score"] == result.total_score:
                player_rank = entry["rank"]
                break
        
        # If not in top 30, calculate approximate rank
        if player_rank is None:
            # Player didn't make top 30
            player_rank = leaderboard_size + 1
        
        return jsonify({
            "success": True,
            "total_score": result.total_score,
            "tokens_count": result.tokens_count,
            "breakdown": result.breakdown,
            "player_rank": player_rank,
            "leaderboard_size": leaderboard_size,
        })


# ============================================================================
# API Routes - Questions (for gameplay)
# ============================================================================

@blueprint.route("/api/quiz/questions/<question_id>")
@quiz_auth_required
def api_get_question(question_id: str):
    """Get question details (for displaying during gameplay)."""
    with get_session() as session:
        from .models import QuizQuestion
        from sqlalchemy import select
        
        stmt = select(QuizQuestion).where(QuizQuestion.id == question_id)
        question = session.execute(stmt).scalar_one_or_none()
        
        if not question:
            return jsonify({"error": "Question not found"}), 404
        
        return jsonify({
            "id": question.id,
            "difficulty": question.difficulty,
            "type": question.type,
            "prompt_key": question.prompt_key,
            "explanation_key": question.explanation_key,
            "answers": question.answers,
            "media": question.media,
        })


# ============================================================================
# Admin API Routes - Content Import
# ============================================================================

def webapp_admin_required(f: Callable) -> Callable:
    """Decorator to require webapp admin authentication.
    
    This checks for the webapp's JWT-based admin authentication.
    Falls back to a simple check if the auth system is not available.
    """
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        # Try to use webapp's role-based auth if available
        try:
            from src.app.auth.decorators import require_role
            from src.app.auth import Role
            
            # Check if user has admin role via webapp auth
            role = getattr(g, "role", None)
            if role is None:
                return jsonify({
                    "error": "Admin authentication required",
                    "code": "ADMIN_AUTH_REQUIRED"
                }), 401
            
            # ROLE_ORDER is ["admin", "editor", "user", "guest"]
            # Admin is index 0, so we need role to be "admin"
            if role != "admin":
                return jsonify({
                    "error": "Admin role required",
                    "code": "ADMIN_ROLE_REQUIRED"
                }), 403
                
        except ImportError:
            # Auth module not available, fall back to header-based auth
            # This is a placeholder for development/testing
            admin_key = request.headers.get("X-Admin-Key")
            import os
            expected_key = os.environ.get("QUIZ_ADMIN_KEY")
            
            if not expected_key:
                return jsonify({
                    "error": "Admin import not configured",
                    "code": "ADMIN_NOT_CONFIGURED"
                }), 503
            
            if admin_key != expected_key:
                return jsonify({
                    "error": "Invalid admin key",
                    "code": "ADMIN_KEY_INVALID"
                }), 401
        
        return f(*args, **kwargs)
    return decorated



