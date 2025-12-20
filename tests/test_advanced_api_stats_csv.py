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


def test_stats_csv_endpoint(client):
    # Mock _make_bls_request
    with patch("src.app.search.advanced_api._make_bls_request") as mock_bls:
        # Mock total hits response
        mock_total_resp = MagicMock()
        mock_total_resp.json.return_value = {"summary": {"numberOfHits": 100}}

        # Mock grouping response
        mock_group_resp = MagicMock()
        mock_group_resp.json.return_value = {
            "hitGroups": [
                {"identity": "ARG", "size": 50},
                {"identity": "ESP", "size": 50},
            ]
        }

        # Configure side_effect to return different responses based on params
        def side_effect(url, params):
            if params.get("group"):
                return mock_group_resp
            return mock_total_resp

        mock_bls.side_effect = side_effect

        response = client.get("/search/advanced/stats/csv?q=casa&mode=lemma")

        assert response.status_code == 200
        assert response.headers["Content-Type"] == "text/csv; charset=utf-8"
        assert (
            response.headers["Content-Disposition"]
            == "attachment; filename=estadisticas_busqueda.csv"
        )

        content = response.data.decode("utf-8")

        # Check metadata
        assert "# corpus=CO.RA.PAN" in content
        assert "# query_type=CQL" in content
        assert "# total_hits=100" in content

        # Check CSV header
        assert "chart_id,chart_label,dimension,count,relative_frequency" in content

        # Check data
        assert "by_country,Por país,ARG,50,0.500000" in content
        assert "by_country,Por país,ESP,50,0.500000" in content
