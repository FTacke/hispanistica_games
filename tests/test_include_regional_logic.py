from src.app.search.cql import resolve_countries_for_include_regional


def test_include_regional_defaults():
    # When no countries specified, include_regional False -> national only
    countries_off = resolve_countries_for_include_regional([], False)
    assert "ARG" in countries_off
    assert "ARG-CHU" not in countries_off

    # include_regional True -> national + regional
    countries_on = resolve_countries_for_include_regional([], True)
    assert "ARG-CHU" in countries_on
    assert len(countries_on) > len(countries_off)


def test_include_regional_excludes_regional():
    # When countries list includes regional codes but include_regional False -> excluded
    input_countries = ["ARG", "ARG-CHU", "ESP", "ESP-CAN"]
    result = resolve_countries_for_include_regional(input_countries, False)
    assert "ARG-CHU" not in result
    assert "ARG" in result
    assert "ESP-CAN" not in result

    # If include_regional True -> keep as-is
    result2 = resolve_countries_for_include_regional(input_countries, True)
    assert "ARG-CHU" in result2
    assert "ESP-CAN" in result2
