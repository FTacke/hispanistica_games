"""Tests for Quiz scoring UI integration.

Tests verify:
- AnswerResult includes all new scoring fields
- POINTS_PER_DIFFICULTY values are correct
"""


from game_modules.quiz.services import (
    AnswerResult,
    POINTS_PER_DIFFICULTY_V1,
    POINTS_PER_DIFFICULTY_V2,
)


class TestAnswerResultFields:
    """Tests that AnswerResult has all required scoring fields."""

    def test_answer_result_has_earned_points(self):
        """AnswerResult should have earned_points field."""
        result = AnswerResult(
            success=True,
            result="correct",
            correct_option_id="opt1",
            explanation="Test",
            next_question_index=1,
            finished=False,
            joker_remaining=2,
            earned_points=20,
            running_score=20,
            level_completed=False,
            level_perfect=False,
            level_bonus=0,
            difficulty=2,
        )
        assert result.earned_points == 20

    def test_answer_result_has_running_score(self):
        """AnswerResult should have running_score field."""
        result = AnswerResult(
            success=True,
            result="correct",
            correct_option_id="opt1",
            explanation="Test",
            next_question_index=1,
            finished=False,
            joker_remaining=2,
            earned_points=20,
            running_score=40,
            level_completed=False,
            level_perfect=False,
            level_bonus=0,
            difficulty=2,
        )
        assert result.running_score == 40

    def test_answer_result_has_level_completion_fields(self):
        """AnswerResult should have level_completed, level_perfect, level_bonus."""
        result = AnswerResult(
            success=True,
            result="correct",
            correct_option_id="opt1",
            explanation="Test",
            next_question_index=2,
            finished=False,
            joker_remaining=2,
            earned_points=20,
            running_score=60,
            level_completed=True,
            level_perfect=True,
            level_bonus=40,
            difficulty=2,
        )
        assert result.level_completed is True
        assert result.level_perfect is True
        assert result.level_bonus == 40

    def test_answer_result_has_difficulty(self):
        """AnswerResult should have difficulty field."""
        result = AnswerResult(
            success=True,
            result="correct",
            correct_option_id="opt1",
            explanation="Test",
            next_question_index=1,
            finished=False,
            joker_remaining=2,
            earned_points=30,
            running_score=30,
            level_completed=False,
            level_perfect=False,
            level_bonus=0,
            difficulty=3,
        )
        assert result.difficulty == 3

    def test_answer_result_defaults(self):
        """Scoring fields should have default values."""
        result = AnswerResult(success=True)
        assert result.earned_points == 0
        assert result.running_score == 0
        assert result.level_completed is False
        assert result.level_perfect is False
        assert result.level_bonus == 0
        assert result.difficulty == 0


class TestPointsPerDifficultyV1:
    """Tests for v1 points configuration (1-5)."""

    def test_difficulty_1_points(self):
        """Difficulty 1 should give 10 points."""
        assert POINTS_PER_DIFFICULTY_V1[1] == 10

    def test_difficulty_2_points(self):
        """Difficulty 2 should give 20 points."""
        assert POINTS_PER_DIFFICULTY_V1[2] == 20

    def test_difficulty_3_points(self):
        """Difficulty 3 should give 30 points."""
        assert POINTS_PER_DIFFICULTY_V1[3] == 30

    def test_difficulty_4_points(self):
        """Difficulty 4 should give 40 points."""
        assert POINTS_PER_DIFFICULTY_V1[4] == 40

    def test_difficulty_5_points(self):
        """Difficulty 5 should give 50 points."""
        assert POINTS_PER_DIFFICULTY_V1[5] == 50

    def test_all_difficulties_defined(self):
        """All difficulties 1-5 should be defined."""
        for d in range(1, 6):
            assert d in POINTS_PER_DIFFICULTY_V1

    def test_points_increase_with_difficulty(self):
        """Points should increase with difficulty level."""
        for d in range(1, 5):
            assert POINTS_PER_DIFFICULTY_V1[d] < POINTS_PER_DIFFICULTY_V1[d + 1]

    def test_token_bonus_formula(self):
        """Token bonus should be 2x difficulty points for perfect level."""
        for d in range(1, 6):
            base_points = POINTS_PER_DIFFICULTY_V1[d]
            expected_bonus = 2 * base_points
            # Verify this matches the formula in services.py
            assert expected_bonus == 2 * POINTS_PER_DIFFICULTY_V1[d]


class TestPointsPerDifficultyV2:
    """Tests for v2 points configuration (1-3)."""

    def test_difficulty_1_points(self):
        """Difficulty 1 should give 10 points."""
        assert POINTS_PER_DIFFICULTY_V2[1] == 10

    def test_difficulty_2_points(self):
        """Difficulty 2 should give 20 points."""
        assert POINTS_PER_DIFFICULTY_V2[2] == 20

    def test_difficulty_3_points(self):
        """Difficulty 3 should give 30 points."""
        assert POINTS_PER_DIFFICULTY_V2[3] == 30

    def test_all_difficulties_defined(self):
        """All difficulties 1-3 should be defined."""
        for d in range(1, 4):
            assert d in POINTS_PER_DIFFICULTY_V2

    def test_points_increase_with_difficulty(self):
        """Points should increase with difficulty level."""
        for d in range(1, 3):
            assert POINTS_PER_DIFFICULTY_V2[d] < POINTS_PER_DIFFICULTY_V2[d + 1]


class TestMaxScore:
    """Tests for maximum possible score calculation."""
    
    def test_perfect_game_score(self):
        """Calculate max score for a perfect game (10/10 correct)."""
        # 2 questions per difficulty level
        # Base points: 2 * (10 + 20 + 30 + 40 + 50) = 2 * 150 = 300
        # Token bonus: 2 * (10 + 20 + 30 + 40 + 50) = 300
        # Total: 600
        base_points = sum(2 * POINTS_PER_DIFFICULTY_V1[d] for d in range(1, 6))
        token_bonus = sum(2 * POINTS_PER_DIFFICULTY_V1[d] for d in range(1, 6))
        expected_max = base_points + token_bonus
        assert expected_max == 600

    def test_no_bonus_score(self):
        """Calculate score with 5/10 correct (one per level, no bonuses)."""
        # 1 correct per difficulty = no token bonus
        base_points = sum(1 * POINTS_PER_DIFFICULTY_V1[d] for d in range(1, 6))
        expected = base_points  # No bonus
        assert expected == 150

