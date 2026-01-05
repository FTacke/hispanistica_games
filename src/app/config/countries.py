"""
Configuración centralizada de códigos de país y regiones para games_hispanistica.

Este módulo proporciona:
- Códigos estandarizados para países y regiones
- Mapeo entre códigos antiguos y nuevos
- Funciones helper para conversión y filtrado
- Distinción clara entre capitales nacionales y regionales

Convenciones:
- Capitales nacionales: Código ISO 3166-1 alpha-3 (e.g., 'ARG', 'ESP')
- Capitales regionales: Código nacional + '-' + código regional 3 letras (e.g., 'ARG-CBA', 'ESP-CAN')
- Todos los códigos en MAYÚSCULAS
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

# ==============================================================================
# TIPOS Y CLASES
# ==============================================================================

LocationType = Literal["national", "regional"]


@dataclass(frozen=True)
class Location:
    """
    Representa una ubicación geográfica (país o región).

    Atributos:
        code: Código único (e.g., 'ARG', 'ARG-CBA', 'ESP')
        name_es: Nombre completo en español para mostrar en UI
        type: Tipo de ubicación ('national' = capital nacional, 'regional' = capital regional)
        country_code: Código del país padre (e.g., 'ARG' para 'ARG-CBA')
        iso_code: Código ISO 3166-1 alpha-3 oficial (si aplica, solo para nacionales)
        coordinates: Coordenadas (lat, lng) para visualización en mapa
    """

    code: str
    name_es: str
    type: LocationType
    country_code: str
    iso_code: str | None = None
    coordinates: tuple[float, float] | None = None


# ==============================================================================
# DEFINICIONES DE UBICACIONES
# ==============================================================================

LOCATIONS: list[Location] = [
    # -------------------------------------------------------------------------
    # ARGENTINA
    # -------------------------------------------------------------------------
    Location(
        code="ARG",
        name_es="Argentina: Buenos Aires",
        type="national",
        country_code="ARG",
        iso_code="ARG",
        coordinates=(-34.6118, -58.4173),
    ),
    Location(
        code="ARG-CBA",
        name_es="Argentina: Córdoba",
        type="regional",
        country_code="ARG",
        coordinates=(-31.4201, -64.1888),
    ),
    Location(
        code="ARG-CHU",
        name_es="Argentina: Chubut (Trelew)",
        type="regional",
        country_code="ARG",
        coordinates=(-43.2489, -65.3051),
    ),
    Location(
        code="ARG-SDE",
        name_es="Argentina: Santiago del Estero",
        type="regional",
        country_code="ARG",
        coordinates=(-27.7951, -64.2615),
    ),
    # -------------------------------------------------------------------------
    # BOLIVIA
    # -------------------------------------------------------------------------
    Location(
        code="BOL",
        name_es="Bolivia: La Paz",
        type="national",
        country_code="BOL",
        iso_code="BOL",
        coordinates=(-16.5000, -68.1500),
    ),
    # -------------------------------------------------------------------------
    # CHILE
    # -------------------------------------------------------------------------
    Location(
        code="CHL",
        name_es="Chile: Santiago",
        type="national",
        country_code="CHL",
        iso_code="CHL",
        coordinates=(-33.4489, -70.6693),
    ),
    # -------------------------------------------------------------------------
    # COLOMBIA
    # -------------------------------------------------------------------------
    Location(
        code="COL",
        name_es="Colombia: Bogotá",
        type="national",
        country_code="COL",
        iso_code="COL",
        coordinates=(4.6097, -74.0817),
    ),
    # -------------------------------------------------------------------------
    # COSTA RICA
    # -------------------------------------------------------------------------
    Location(
        code="CRI",
        name_es="Costa Rica: San José",
        type="national",
        country_code="CRI",
        iso_code="CRI",
        coordinates=(9.9281, -84.0907),
    ),
    # -------------------------------------------------------------------------
    # CUBA
    # -------------------------------------------------------------------------
    Location(
        code="CUB",
        name_es="Cuba: La Habana",
        type="national",
        country_code="CUB",
        iso_code="CUB",
        coordinates=(23.1330, -82.3830),
    ),
    # -------------------------------------------------------------------------
    # ECUADOR
    # -------------------------------------------------------------------------
    Location(
        code="ECU",
        name_es="Ecuador: Quito",
        type="national",
        country_code="ECU",
        iso_code="ECU",
        coordinates=(-0.2300, -78.5200),
    ),
    # -------------------------------------------------------------------------
    # EL SALVADOR
    # -------------------------------------------------------------------------
    Location(
        code="SLV",
        name_es="El Salvador: San Salvador",
        type="national",
        country_code="SLV",
        iso_code="SLV",
        coordinates=(13.6929, -89.2182),
    ),
    # -------------------------------------------------------------------------
    # ESPAÑA
    # -------------------------------------------------------------------------
    Location(
        code="ESP",
        name_es="España: Madrid",
        type="national",
        country_code="ESP",
        iso_code="ESP",
        coordinates=(40.4168, -3.7038),
    ),
    Location(
        code="ESP-CAN",
        name_es="España: La Laguna (Canarias)",
        type="regional",
        country_code="ESP",
        coordinates=(28.4874, -16.3141),
    ),
    Location(
        code="ESP-SEV",
        name_es="España: Sevilla (Andalucía)",
        type="regional",
        country_code="ESP",
        coordinates=(37.3886, -5.9823),
    ),
    # -------------------------------------------------------------------------
    # GUATEMALA
    # -------------------------------------------------------------------------
    Location(
        code="GTM",
        name_es="Guatemala: Ciudad de Guatemala",
        type="national",
        country_code="GTM",
        iso_code="GTM",
        coordinates=(14.6349, -90.5069),
    ),
    # -------------------------------------------------------------------------
    # HONDURAS
    # -------------------------------------------------------------------------
    Location(
        code="HND",
        name_es="Honduras: Tegucigalpa",
        type="national",
        country_code="HND",
        iso_code="HND",
        coordinates=(14.0723, -87.1921),
    ),
    # -------------------------------------------------------------------------
    # MÉXICO
    # -------------------------------------------------------------------------
    Location(
        code="MEX",
        name_es="México: Ciudad de México",
        type="national",
        country_code="MEX",
        iso_code="MEX",
        coordinates=(19.4326, -99.1332),
    ),
    # -------------------------------------------------------------------------
    # NICARAGUA
    # -------------------------------------------------------------------------
    Location(
        code="NIC",
        name_es="Nicaragua: Managua",
        type="national",
        country_code="NIC",
        iso_code="NIC",
        coordinates=(12.1364, -86.2514),
    ),
    # -------------------------------------------------------------------------
    # PANAMÁ
    # -------------------------------------------------------------------------
    Location(
        code="PAN",
        name_es="Panamá: Ciudad de Panamá",
        type="national",
        country_code="PAN",
        iso_code="PAN",
        coordinates=(8.9824, -79.5199),
    ),
    # -------------------------------------------------------------------------
    # PARAGUAY
    # -------------------------------------------------------------------------
    Location(
        code="PRY",
        name_es="Paraguay: Asunción",
        type="national",
        country_code="PRY",
        iso_code="PRY",
        coordinates=(-25.2637, -57.5759),
    ),
    # -------------------------------------------------------------------------
    # PERÚ
    # -------------------------------------------------------------------------
    Location(
        code="PER",
        name_es="Perú: Lima",
        type="national",
        country_code="PER",
        iso_code="PER",
        coordinates=(-12.0464, -77.0428),
    ),
    # -------------------------------------------------------------------------
    # REPÚBLICA DOMINICANA
    # -------------------------------------------------------------------------
    Location(
        code="DOM",
        name_es="República Dominicana: Santo Domingo",
        type="national",
        country_code="DOM",
        iso_code="DOM",
        coordinates=(18.4663, -69.9526),
    ),
    # -------------------------------------------------------------------------
    # URUGUAY
    # -------------------------------------------------------------------------
    Location(
        code="URY",
        name_es="Uruguay: Montevideo",
        type="national",
        country_code="URY",
        iso_code="URY",
        coordinates=(-34.9011, -56.1910),
    ),
    # -------------------------------------------------------------------------
    # USA / ESTADOS UNIDOS
    # -------------------------------------------------------------------------
    Location(
        code="USA",
        name_es="Estados Unidos: Miami",
        type="national",
        country_code="USA",
        iso_code="USA",
        coordinates=(25.7617, -80.1918),
    ),
    # -------------------------------------------------------------------------
    # VENEZUELA
    # -------------------------------------------------------------------------
    Location(
        code="VEN",
        name_es="Venezuela: Caracas",
        type="national",
        country_code="VEN",
        iso_code="VEN",
        coordinates=(10.5000, -66.9333),
    ),
]


# ==============================================================================
# MAPEOS PARA COMPATIBILIDAD CON CÓDIGOS ANTIGUOS
# ==============================================================================

LEGACY_CODE_MAP: dict[str, str] = {
    # Códigos ISO no estándar → ISO 3166-1 alpha-3 correcto
    "CHI": "CHL",  # Chile (ISO correcto es CHL)
    "CR": "CRI",  # Costa Rica (alpha-2 → alpha-3)
    "SAL": "SLV",  # El Salvador (ISO correcto es SLV)
    "GUA": "GTM",  # Guatemala (ISO correcto es GTM)
    "HON": "HND",  # Honduras (ISO correcto es HND)
    "PAR": "PRY",  # Paraguay (ISO correcto es PRY)
    "RD": "DOM",  # República Dominicana (ISO correcto es DOM)
    "URU": "URY",  # Uruguay (ISO correcto es URY)
    # Códigos regionales con mayúsculas inconsistentes → MAYÚSCULAS
    "ARG-Cba": "ARG-CBA",
    "ARG-Cht": "ARG-CHU",
    "ARG-SdE": "ARG-SDE",
    "ARG-CHT": "ARG-CHU",  # HTML variant
    # España: ES- prefix → ESP (capital nacional) o ESP- (regionales)
    "ES": "ESP",  # Código incompleto
    "ES-MAD": "ESP",  # Madrid como código nacional, no regional
    "ES-CAN": "ESP-CAN",  # Canarias
    "ES-SEV": "ESP-SEV",  # Sevilla
}

# Mapeo inverso: Nombres en español → Códigos (usado en stats_country.db)
NAME_TO_CODE_MAP: dict[str, str] = {
    "Argentina": "ARG",
    "Argentina/Chubut": "ARG-CHU",
    "Argentina/Córdoba": "ARG-CBA",
    "Argentina/Santiago del Estero": "ARG-SDE",
    "Bolivia": "BOL",
    "Chile": "CHL",
    "Colombia": "COL",
    "Costa Rica": "CRI",
    "Cuba": "CUB",
    "Ecuador": "ECU",
    "El Salvador": "SLV",
    "España/Canarias": "ESP-CAN",
    "España": "ESP",
    "España/Sevilla": "ESP-SEV",
    "Guatemala": "GTM",
    "Honduras": "HND",
    "México": "MEX",
    "Nicaragua": "NIC",
    "Panamá": "PAN",
    "Paraguay": "PRY",
    "Perú": "PER",
    "República Dominicana": "DOM",
    "Uruguay": "URY",
    "Estados Unidos": "USA",
    "Venezuela": "VEN",
}


# ==============================================================================
# ÍNDICES PARA ACCESO RÁPIDO
# ==============================================================================

_CODE_INDEX: dict[str, Location] = {loc.code: loc for loc in LOCATIONS}


# ==============================================================================
# FUNCIONES PÚBLICAS
# ==============================================================================


def normalize_country_code(code: str) -> str:
    """
    Normaliza código de país/región a estándar actual.

    - Convierte códigos antiguos a nuevos (e.g., 'CHI' → 'CHL')
    - Normaliza a MAYÚSCULAS (e.g., 'arg' → 'ARG')
    - Corrige mayúsculas inconsistentes (e.g., 'ARG-Cba' → 'ARG-CBA')

    Args:
        code: Código a normalizar (puede ser antiguo, mixed-case, etc.)

    Returns:
        Código normalizado en MAYÚSCULAS

    Examples:
        >>> normalize_country_code('CHI')
        'CHL'
        >>> normalize_country_code('arg')
        'ARG'
        >>> normalize_country_code('ARG-Cba')
        'ARG-CBA'
        >>> normalize_country_code('ES-MAD')
        'ESP'
    """
    if not code:
        return ""

    # Primero buscar en mapeo legacy
    if code in LEGACY_CODE_MAP:
        return LEGACY_CODE_MAP[code]

    # Normalizar a mayúsculas
    normalized = code.upper()

    # Si sigue sin estar mapeado, devolver tal cual (ya en mayúsculas)
    return LEGACY_CODE_MAP.get(normalized, normalized)


def get_location(code: str) -> Location | None:
    """
    Obtiene objeto Location por código.

    Normaliza el código automáticamente antes de buscar.

    Args:
        code: Código de país o región

    Returns:
        Location si existe, None si no se encuentra

    Examples:
        >>> loc = get_location('ARG')
        >>> loc.name_es
        'Argentina: Buenos Aires'
        >>> get_location('INVALID')
        None
    """
    normalized = normalize_country_code(code)
    return _CODE_INDEX.get(normalized)


def code_to_name(code: str, fallback: str = "") -> str:
    """
    Convierte código a nombre completo en español.

    Args:
        code: Código de país o región
        fallback: Valor a devolver si no se encuentra (default: código original)

    Returns:
        Nombre en español o fallback

    Examples:
        >>> code_to_name('ARG')
        'Argentina: Buenos Aires'
        >>> code_to_name('ARG-CBA')
        'Argentina: Córdoba'
        >>> code_to_name('INVALID', 'Desconocido')
        'Desconocido'
    """
    loc = get_location(code)
    if loc:
        return loc.name_es
    return fallback if fallback else code


def name_to_code(name: str, fallback: str | None = None) -> str | None:
    """
    Convierte nombre en español a código.

    Usado para migrar datos de stats_country.db.

    Args:
        name: Nombre completo en español (e.g., "Argentina", "España/Madrid")
        fallback: Valor a retornar si no se encuentra el código (default: None)

    Returns:
        Código correspondiente, fallback si no se encuentra, o None

    Examples:
        >>> name_to_code('Argentina')
        'ARG'
        >>> name_to_code('España/Madrid')
        'ESP'
        >>> name_to_code('Unknown', fallback='UNK')
        'UNK'
    """
    return NAME_TO_CODE_MAP.get(name, fallback)


def get_all_locations() -> list[Location]:
    """
    Devuelve todas las ubicaciones (nacionales + regionales).

    Returns:
        Lista completa de ubicaciones ordenada por código
    """
    return sorted(LOCATIONS, key=lambda loc: loc.code)


def get_national_capitals() -> list[Location]:
    """
    Devuelve solo capitales nacionales.

    Returns:
        Lista de ubicaciones tipo 'national' ordenada por código

    Examples:
        >>> capitals = get_national_capitals()
        >>> len(capitals)
        19
        >>> capitals[0].code
        'ARG'
    """
    return [loc for loc in LOCATIONS if loc.type == "national"]


def get_regional_capitals() -> list[Location]:
    """
    Devuelve solo capitales regionales.

    Returns:
        Lista de ubicaciones tipo 'regional' ordenada por código

    Examples:
        >>> regionals = get_regional_capitals()
        >>> any(loc.code == 'ARG-CBA' for loc in regionals)
        True
    """
    return [loc for loc in LOCATIONS if loc.type == "regional"]


def get_locations_by_country(country_code: str) -> list[Location]:
    """
    Devuelve todas las ubicaciones (nacional + regionales) de un país.

    Args:
        country_code: Código del país (e.g., 'ARG', 'ESP')

    Returns:
        Lista de ubicaciones del país ordenada por tipo (nacional primero)

    Examples:
        >>> locs = get_locations_by_country('ARG')
        >>> len(locs)
        4
        >>> locs[0].type
        'national'
        >>> locs[1].type
        'regional'
    """
    normalized = normalize_country_code(country_code)
    results = [loc for loc in LOCATIONS if loc.country_code == normalized]
    # Ordenar: nacional primero, luego regionales por código
    return sorted(results, key=lambda loc: (loc.type != "national", loc.code))


def get_country_name(code: str) -> str:
    """
    Obtiene solo el nombre del país (sin ciudad).

    Args:
        code: Código de ubicación

    Returns:
        Nombre del país sin ciudad (e.g., "Argentina", "España")

    Examples:
        >>> get_country_name('ARG')
        'Argentina'
        >>> get_country_name('ARG-CBA')
        'Argentina'
        >>> get_country_name('ESP')
        'España'
    """
    loc = get_location(code)
    if loc:
        # Extraer país del nombre completo (formato: "País: Ciudad")
        return loc.name_es.split(":")[0].strip()
    return code


def is_national_capital(code: str) -> bool:
    """
    Verifica si un código corresponde a una capital nacional.

    Args:
        code: Código a verificar

    Returns:
        True si es capital nacional, False en caso contrario

    Examples:
        >>> is_national_capital('ARG')
        True
        >>> is_national_capital('ARG-CBA')
        False
    """
    loc = get_location(code)
    return loc.type == "national" if loc else False


def is_regional_capital(code: str) -> bool:
    """
    Verifica si un código corresponde a una capital regional.

    Args:
        code: Código a verificar

    Returns:
        True si es capital regional, False en caso contrario

    Examples:
        >>> is_regional_capital('ARG-CBA')
        True
        >>> is_regional_capital('ARG')
        False
    """
    loc = get_location(code)
    return loc.type == "regional" if loc else False


def to_json_dict(loc: Location) -> dict:
    """
    Convierte Location a diccionario JSON-serializable.

    Útil para exportar a JavaScript.

    Args:
        loc: Objeto Location

    Returns:
        Diccionario con todos los campos
    """
    return {
        "code": loc.code,
        "name": loc.name_es,
        "type": loc.type,
        "country_code": loc.country_code,
        "iso_code": loc.iso_code,
        "coordinates": loc.coordinates,
    }


def export_all_to_json() -> list[dict]:
    """
    Exporta todas las ubicaciones a formato JSON.

    Útil para generar endpoint `/api/locations.json`.

    Returns:
        Lista de diccionarios JSON-serializables
    """
    return [to_json_dict(loc) for loc in get_all_locations()]


# ==============================================================================
# VALIDACIÓN AL IMPORTAR
# ==============================================================================


def _validate_locations() -> None:
    """Valida que no haya códigos duplicados."""
    codes = [loc.code for loc in LOCATIONS]
    if len(codes) != len(set(codes)):
        duplicates = [code for code in codes if codes.count(code) > 1]
        raise ValueError(f"Códigos duplicados encontrados: {duplicates}")


_validate_locations()
