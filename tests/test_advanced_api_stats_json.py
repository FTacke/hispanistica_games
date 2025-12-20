import pytest
from unittest.mock import patch, MagicMock
from flask import Flask

from src.app.search.advanced_api import bp


@pytest.fixture
def app():
    app = Flask(__name__)
    app.register_blueprint(bp)
    return app


@pytest.fixture
def client(app):
    return app.test_client()


def test_stats_json_aggregates_group_identities(client):
    """
    Ensure /search/advanced/stats aggregates group identities that contain
    composite values (e.g. "VEN|m", "COL|m") so that keys are normalized
    and counts for identical keys are summed.
    """
    with patch("src.app.search.advanced_api._make_bls_request") as mock_bls:
        # total hits response
        total_resp = MagicMock()
        total_resp.json.return_value = {"summary": {"numberOfHits": 14}}

        # grouping for country (simple)
        group_country = MagicMock()
        group_country.json.return_value = {
            "hitGroups": [
                {"identity": "VEN", "size": 7},
                {"identity": "COL", "size": 4},
                {"identity": "PER", "size": 3},
            ]
        }

        # grouping for sex returns identities that include country prefixes
        group_sex = MagicMock()
        group_sex.json.return_value = {
            "hitGroups": [
                {"identity": "VEN|m", "size": 3},
                {"identity": "COL|m", "size": 4},
                {"identity": "VEN|f", "size": 7},
            ]
        }

        # default grouping response for other dims
        group_generic = MagicMock()
        group_generic.json.return_value = {"hitGroups": []}

        def side_effect(url, params):
            # count request (no group param)
            if not params.get("group"):
                return total_resp
            if params.get("group") == "hit:country_code":
                return group_country
            if params.get("group") == "hit:speaker_sex":
                return group_sex
            return group_generic

        mock_bls.side_effect = side_effect

        rv = client.get("/search/advanced/stats?q=casa&mode=lemma")
        assert rv.status_code == 200
        data = rv.get_json()

        # by_country should come through as 3 groups
        assert "by_country" in data
        assert len(data["by_country"]) == 3

        # by_sex must be normalized/aggregated: keys should be just 'm' and 'f'
        assert "by_sex" in data
        keys = sorted([item["key"] for item in data["by_sex"]])
        assert keys == ["f", "m"]

        # counts should be summed: m => 3+4=7, f => 7
        counts = {item["key"]: item["n"] for item in data["by_sex"]}
        assert counts.get("m") == 7
        assert counts.get("f") == 7
