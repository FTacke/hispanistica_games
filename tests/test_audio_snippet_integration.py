from pydub.generators import Sine

from src.app import create_app
from src.app.services.media_store import MP3_SPLIT_DIR, MP3_TEMP_DIR
from src.app.services.audio_snippets import build_snippet


def setup_test_split_file(filename_stem: str = "2025-11-17_ARG_Test"):
    # Create directory for ARG split files
    country_dir = MP3_SPLIT_DIR / "ARG"
    country_dir.mkdir(parents=True, exist_ok=True)

    split_filename = f"{filename_stem}_01.mp3"
    split_path = country_dir / split_filename

    if split_path.exists():
        return split_path

    # Generate 12-second sine tone as MP3 (need ffmpeg in PATH)
    tone = Sine(440).to_audio_segment(duration=12000)
    tone = tone - 3  # Slightly lower volume
    tone.export(split_path, format="mp3")
    return split_path


def teardown_file(path):
    try:
        path.unlink()
    except Exception:
        pass


def test_build_snippet_and_play_audio_route(tmp_path):
    # Create a sample split file
    split_path = setup_test_split_file()
    assert split_path.exists()

    # Setup Flask test client
    app = create_app()
    app.config["TESTING"] = True
    app.config["ALLOW_PUBLIC_TEMP_AUDIO"] = True

    client = app.test_client()

    # Build snippet using build_snippet service (start/end in seconds)
    filename = "2025-11-17_ARG_Test.mp3"
    start = 2.0
    end = 3.5

    # Ensure temp directory is clean
    for f in MP3_TEMP_DIR.glob("*"):
        try:
            f.unlink()
        except Exception:
            pass

    snippet_path = build_snippet(
        filename, start, end, token_id="argx_demo", snippet_type="pal"
    )
    assert snippet_path.exists()
    assert snippet_path.suffix == ".mp3"

    # Call the /media/play_audio route
    rv = client.get(
        f"/media/play_audio/{filename}?start={start}&end={end}&token_id=argx_demo&type=pal"
    )
    assert rv.status_code == 200
    assert rv.content_type == "audio/mpeg"

    # Ensure file exists in temp dir with expected prefix
    files = list(MP3_TEMP_DIR.glob("corapan_*argx_demo*.mp3"))
    assert len(files) >= 1
    # Ensure pal naming
    assert snippet_path.name.endswith("_pal.mp3")

    # Cleanup
    teardown_file(split_path)
    for f in MP3_TEMP_DIR.glob("corapan_*argx_demo*.mp3"):
        teardown_file(f)


def test_play_audio_download_sets_content_disposition():
    split_path = setup_test_split_file()
    assert split_path.exists()
    app = create_app()
    app.config["TESTING"] = True
    app.config["ALLOW_PUBLIC_TEMP_AUDIO"] = True
    client = app.test_client()

    filename = "2025-11-17_ARG_Test.mp3"
    start = 2.0
    end = 3.5
    # Ensure snippet exists
    snippet_path = build_snippet(
        filename, start, end, token_id="argx_demo", snippet_type="pal"
    )
    assert snippet_path.exists()

    rv = client.get(
        f"/media/play_audio/{filename}?start={start}&end={end}&token_id=argx_demo&type=pal&download=true"
    )
    assert rv.status_code == 200
    content_disposition = rv.headers.get("Content-Disposition")
    assert content_disposition and "attachment" in content_disposition.lower()
    assert "_pal.mp3" in content_disposition

    # cleanup
    for f in MP3_TEMP_DIR.glob("corapan_*argx_demo*.mp3"):
        teardown_file(f)


def test_find_split_file_and_cache_naming():
    # Ensure split file exists for _01
    split_path = setup_test_split_file()
    assert split_path.exists()

    # Test that find_split_file locates the _01 split for a short window
    from src.app.services.audio_snippets import find_split_file

    res = find_split_file("2025-11-17_ARG_Test.mp3", 2.0, 3.5)
    assert res is not None
    split_found_path, suffix = res
    assert suffix == "_01"
    assert split_found_path.exists()

    # Test cache filename for 'ctx' type
    target_ctx = build_snippet(
        "2025-11-17_ARG_Test.mp3", 1.0, 2.1, token_id="argx_demo", snippet_type="ctx"
    )
    assert target_ctx.exists()
    assert target_ctx.name.endswith("_ctx.mp3")

    # cleanup
    for f in MP3_TEMP_DIR.glob("corapan_*argx_demo*.mp3"):
        teardown_file(f)


def test_play_audio_public_without_config_flag():
    # If ALLOW_PUBLIC_TEMP_AUDIO is False, /media/play_audio should still work (public)
    split_path = setup_test_split_file()
    assert split_path.exists()

    app = create_app()
    app.config["TESTING"] = True
    app.config["ALLOW_PUBLIC_TEMP_AUDIO"] = False
    client = app.test_client()

    filename = "2025-11-17_ARG_Test.mp3"
    start = 2.0
    end = 3.5

    rv = client.get(
        f"/media/play_audio/{filename}?start={start}&end={end}&token_id=argx_demo&type=pal"
    )
    assert rv.status_code == 200
    assert rv.content_type == "audio/mpeg"


def test_play_audio_download_public_without_config_flag():
    split_path = setup_test_split_file()
    assert split_path.exists()

    app = create_app()
    app.config["TESTING"] = True
    app.config["ALLOW_PUBLIC_TEMP_AUDIO"] = False
    client = app.test_client()

    filename = "2025-11-17_ARG_Test.mp3"
    start = 2.0
    end = 3.5
    rv = client.get(
        f"/media/play_audio/{filename}?start={start}&end={end}&token_id=argx_demo&type=pal&download=true"
    )
    assert rv.status_code == 200
    content_disposition = rv.headers.get("Content-Disposition")
    assert content_disposition and "attachment" in content_disposition.lower()


if __name__ == "__main__":
    test_build_snippet_and_play_audio_route(None)
