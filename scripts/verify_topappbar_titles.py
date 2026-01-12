#!/usr/bin/env python3
"""
Verify TopAppBar Title Logic

Tests:
1. Site-Titel ist 'Games.Hispanistica' (nicht 'games.hispanistica')
2. pageTitle wird korrekt mit page_section befüllt
3. data-has-page-title Attribut wird korrekt gesetzt
"""

import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from jinja2 import Environment, FileSystemLoader, select_autoescape

# Setup Jinja environment
template_dir = project_root / "templates"
env = Environment(
    loader=FileSystemLoader(template_dir),
    autoescape=select_autoescape(['html', 'xml'])
)

def test_topappbar_with_page_section():
    """Test TopAppBar mit page_section gesetzt (z.B. Datenschutz)"""
    print("\n=== Test 1: TopAppBar mit page_section='Datenschutz' ===")
    
    # Mock request object
    class MockRequest:
        path = "/privacy"
        full_path = "/privacy"
    
    template = env.get_template("partials/_top_app_bar.html")
    html = template.render(
        page_section="Datenschutz",
        g={'user': None, 'role': None},
        request=MockRequest(),
        url_for=lambda *args, **kwargs: f"/{args[0]}" if args else "/"
    )
    
    # Assertions
    assert 'Games.Hispanistica' in html, "❌ Site-Titel sollte 'Games.Hispanistica' sein"
    assert 'games.hispanistica' not in html, "❌ 'games.hispanistica' sollte nicht mehr vorkommen"
    assert 'data-has-page-title="1"' in html, "❌ data-has-page-title sollte '1' sein"
    assert '>Datenschutz</span>' in html, "❌ pageTitle sollte 'Datenschutz' enthalten"
    
    print("✅ Site-Titel: 'Games.Hispanistica'")
    print("✅ pageTitle: 'Datenschutz'")
    print("✅ data-has-page-title: '1'")

def test_topappbar_without_page_section():
    """Test TopAppBar ohne page_section (z.B. Startseite)"""
    print("\n=== Test 2: TopAppBar ohne page_section (Startseite) ===")
    
    # Mock request object
    class MockRequest:
        path = "/"
        full_path = "/"
    
    template = env.get_template("partials/_top_app_bar.html")
    html = template.render(
        page_name="index",
        g={'user': None, 'role': None},
        request=MockRequest(),
        url_for=lambda *args, **kwargs: f"/{args[0]}" if args else "/"
    )
    
    # Assertions
    assert 'Games.Hispanistica' in html, "❌ Site-Titel sollte 'Games.Hispanistica' sein"
    assert 'games.hispanistica' not in html, "❌ 'games.hispanistica' sollte nicht mehr vorkommen"
    assert 'data-has-page-title="0"' in html, "❌ data-has-page-title sollte '0' sein"
    
    # pageTitle sollte leer sein
    assert 'id="pageTitle" data-page-title-el></span>' in html, "❌ pageTitle sollte leer sein"
    
    print("✅ Site-Titel: 'Games.Hispanistica'")
    print("✅ pageTitle: leer")
    print("✅ data-has-page-title: '0'")

def test_full_page_privacy():
    """Test komplette Privacy-Seite (mit page_section)"""
    print("\n=== Test 3: Privacy-Template hat page_section ===")
    
    with open(project_root / "templates" / "pages" / "privacy.html", "r", encoding="utf-8") as f:
        content = f.read()
    
    assert "{% set page_section = 'Datenschutz' %}" in content, "❌ privacy.html sollte page_section setzen"
    print("✅ privacy.html setzt page_section='Datenschutz'")

def test_full_page_index():
    """Test komplette Index-Seite (ohne page_section)"""
    print("\n=== Test 4: Index-Template hat KEIN page_section ===")
    
    with open(project_root / "templates" / "pages" / "index.html", "r", encoding="utf-8") as f:
        content = f.read()
    
    assert "{% set page_name = 'index' %}" in content, "❌ index.html sollte page_name setzen"
    assert "page_section" not in content or "KEINEN page_section" in content, "❌ index.html sollte kein page_section haben"
    print("✅ index.html setzt page_name='index' (kein page_section)")

if __name__ == "__main__":
    try:
        test_topappbar_with_page_section()
        test_topappbar_without_page_section()
        test_full_page_privacy()
        test_full_page_index()
        
        print("\n" + "="*60)
        print("✅ ALLE TESTS BESTANDEN")
        print("="*60)
        
    except AssertionError as e:
        print(f"\n❌ TEST FEHLGESCHLAGEN: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ FEHLER: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
