from src.app import create_app


def test_corpus_guia_page_available():
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    rv = client.get("/corpus/guia")
    assert rv.status_code == 200
    html = rv.get_data(as_text=True)
    assert "Guía paso a paso" in html
    # Check key content sections are present
    assert "Consulta Simple" in html or "Consulta simple" in html
    assert "Modo Avanzado" in html or "Modo avanzado" in html


def test_nav_drawer_contains_corpus_children():
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    rv = client.get("/")
    assert rv.status_code == 200
    html = rv.get_data(as_text=True)
    # Ensure nav contains 'Corpus' and children links
    assert "Corpus" in html
    assert "Consultar" in html
    assert "/corpus/guia" in html
