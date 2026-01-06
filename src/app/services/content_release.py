"""
Quiz Content Release Deployment Service

Core reusable functions for deploying quiz content releases to production.
Can be used by CLI scripts or dashboard UI.

Usage:
    from app.services.content_release import validate_release_dir, rsync_release_to_server
    
    # Validate local release
    result = validate_release_dir("content/quiz_releases/2026-01-06_1430")
    
    # Deploy to remote server
    rsync_result = rsync_release_to_server(
        local_release_dir="content/quiz_releases/2026-01-06_1430",
        ssh_host="root@server.example.com",
        remote_release_dir="/srv/webapps/app/media/releases/2026-01-06_1430",
        dry_run=False
    )
"""

import json
import logging
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

# Configure logging
logger = logging.getLogger(__name__)


def validate_release_dir(path: str | Path) -> dict[str, Any]:
    """
    Validate a local release directory structure and content.
    
    Checks:
    - topics/ directory exists
    - At least one .json file in topics/
    - All JSON files are valid (parseable)
    - Optional media/ directory
    
    Args:
        path: Path to release directory
        
    Returns:
        {
            "valid": bool,
            "topics_dir": str,
            "topics": [{"file": str, "slug": str, "valid": bool}],
            "media_dir": str | None,
            "errors": [str]
        }
    """
    path = Path(path)
    result = {
        "valid": True,
        "topics_dir": None,
        "topics": [],
        "media_dir": None,
        "errors": []
    }
    
    # Check release directory exists
    if not path.exists():
        result["valid"] = False
        result["errors"].append(f"Release directory not found: {path}")
        return result
    
    if not path.is_dir():
        result["valid"] = False
        result["errors"].append(f"Not a directory: {path}")
        return result
    
    # Check topics/ directory
    topics_dir = path / "topics"
    if not topics_dir.exists():
        result["valid"] = False
        result["errors"].append(f"topics/ directory not found in {path}")
        return result
    
    if not topics_dir.is_dir():
        result["valid"] = False
        result["errors"].append(f"topics/ is not a directory in {path}")
        return result
    
    result["topics_dir"] = str(topics_dir)
    
    # Find and validate JSON files
    json_files = list(topics_dir.glob("*.json"))
    
    if len(json_files) == 0:
        result["valid"] = False
        result["errors"].append(f"No .json files found in {topics_dir}")
        return result
    
    # Validate each JSON file
    for json_file in json_files:
        topic_info = {
            "file": json_file.name,
            "slug": None,
            "valid": True,
            "error": None
        }
        
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Extract slug if present
            if "slug" in data:
                topic_info["slug"] = data["slug"]
                
                # Check if filename matches slug
                expected_filename = f"{data['slug']}.json"
                if json_file.name != expected_filename:
                    topic_info["valid"] = False
                    topic_info["error"] = f"Filename mismatch: {json_file.name} != {expected_filename}"
                    result["valid"] = False
                    result["errors"].append(f"{json_file.name}: {topic_info['error']}")
            else:
                topic_info["valid"] = False
                topic_info["error"] = "Missing 'slug' field"
                result["valid"] = False
                result["errors"].append(f"{json_file.name}: Missing 'slug' field")
                
        except json.JSONDecodeError as e:
            topic_info["valid"] = False
            topic_info["error"] = f"JSON parse error: {e}"
            result["valid"] = False
            result["errors"].append(f"{json_file.name}: {topic_info['error']}")
        except Exception as e:
            topic_info["valid"] = False
            topic_info["error"] = f"Error reading file: {e}"
            result["valid"] = False
            result["errors"].append(f"{json_file.name}: {topic_info['error']}")
        
        result["topics"].append(topic_info)
    
    # Check optional media/ directory
    media_dir = path / "media"
    if media_dir.exists() and media_dir.is_dir():
        result["media_dir"] = str(media_dir)
    
    logger.info(f"Validated release {path}: valid={result['valid']}, topics={len(result['topics'])}")
    
    return result


def compute_release_name(path: str | Path, override: Optional[str] = None) -> str:
    """
    Compute release name from path or use override.
    
    Args:
        path: Path to release directory
        override: Optional override name
        
    Returns:
        Release name (e.g., "2026-01-06_1430")
    """
    if override:
        return override
    
    path = Path(path)
    return path.name


def rsync_release_to_server(
    local_release_dir: str | Path,
    ssh_host: str,
    remote_release_dir: str,
    *,
    dry_run: bool = False
) -> dict[str, Any]:
    """
    Rsync a local release directory to remote server.
    
    Args:
        local_release_dir: Local path to release directory
        ssh_host: SSH host (user@hostname)
        remote_release_dir: Remote path to release directory
        dry_run: If True, perform dry-run (--dry-run flag)
        
    Returns:
        {
            "success": bool,
            "stdout": str,
            "stderr": str,
            "command": str,
            "dry_run": bool
        }
    """
    local_release_dir = Path(local_release_dir)
    
    if not local_release_dir.exists():
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Local release directory not found: {local_release_dir}",
            "command": "",
            "dry_run": dry_run
        }
    
    # Ensure trailing slash for rsync
    local_path = str(local_release_dir) + "/"
    
    # Build rsync command
    rsync_cmd = [
        "rsync",
        "-avz",  # archive, verbose, compress
        "--delete",  # delete extraneous files from dest
        "-e", "ssh",
    ]
    
    if dry_run:
        rsync_cmd.append("--dry-run")
    
    rsync_cmd.extend([
        local_path,
        f"{ssh_host}:{remote_release_dir}"
    ])
    
    cmd_str = " ".join(rsync_cmd)
    logger.info(f"Rsync command: {cmd_str}")
    
    try:
        result = subprocess.run(
            rsync_cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        logger.info(f"Rsync completed successfully (dry_run={dry_run})")
        
        return {
            "success": True,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "command": cmd_str,
            "dry_run": dry_run
        }
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Rsync failed: {e.stderr}")
        
        return {
            "success": False,
            "stdout": e.stdout,
            "stderr": e.stderr,
            "command": cmd_str,
            "dry_run": dry_run
        }
    except FileNotFoundError:
        logger.error("rsync command not found - please install rsync")
        
        return {
            "success": False,
            "stdout": "",
            "stderr": "rsync command not found - please install rsync",
            "command": cmd_str,
            "dry_run": dry_run
        }


def get_remote_current_target(ssh_host: str, media_root: str) -> Optional[str]:
    """
    Get the target of the 'current' symlink on remote server.
    
    Args:
        ssh_host: SSH host (user@hostname)
        media_root: Remote media root path
        
    Returns:
        Target release name or None if symlink doesn't exist
    """
    current_link = f"{media_root}/current"
    
    # Use readlink to get symlink target
    cmd = [
        "ssh",
        ssh_host,
        f"readlink {current_link} 2>/dev/null || echo ''"
    ]
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        target = result.stdout.strip()
        
        if target:
            # Extract release name from path (e.g., "releases/2026-01-06_1430" -> "2026-01-06_1430")
            if "/" in target:
                release_name = target.split("/")[-1]
            else:
                release_name = target
            
            logger.info(f"Current target: {release_name}")
            return release_name
        else:
            logger.info("No current symlink found")
            return None
            
    except subprocess.CalledProcessError as e:
        logger.warning(f"Failed to read current symlink: {e.stderr}")
        return None


def set_remote_current(ssh_host: str, media_root: str, release_name: str) -> None:
    """
    Set the 'current' symlink to point to a release on remote server.
    
    Args:
        ssh_host: SSH host (user@hostname)
        media_root: Remote media root path
        release_name: Release name to activate
        
    Raises:
        subprocess.CalledProcessError: If command fails
    """
    releases_dir = f"{media_root}/releases"
    current_link = f"{media_root}/current"
    release_path = f"{releases_dir}/{release_name}"
    
    # Use atomic symlink update: ln -sfn
    cmd = [
        "ssh",
        ssh_host,
        f"set -euo pipefail; cd {media_root} && ln -sfn releases/{release_name} current"
    ]
    
    logger.info(f"Setting current -> {release_name}")
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        logger.info(f"Successfully set current -> {release_name}")
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to set current symlink: {e.stderr}")
        raise


def run_remote_seed(
    ssh_host: str,
    container: str,
    topics_dir_in_container: str,
    prune_mode: str = "soft"
) -> dict[str, Any]:
    """
    Run quiz_seed.py on remote server inside Docker container.
    
    Args:
        ssh_host: SSH host (user@hostname)
        container: Docker container name
        topics_dir_in_container: Path to topics directory inside container
        prune_mode: "soft" or "hard" pruning mode
        
    Returns:
        {
            "success": bool,
            "stdout": str,
            "stderr": str,
            "command": str
        }
    """
    # Build docker exec command
    prune_flag = "--prune-soft" if prune_mode == "soft" else "--prune-hard"
    
    docker_cmd = (
        f"docker exec {container} "
        f"python scripts/quiz_seed.py {prune_flag}"
    )
    
    cmd = [
        "ssh",
        ssh_host,
        f"set -euo pipefail; {docker_cmd}"
    ]
    
    cmd_str = " ".join(cmd)
    logger.info(f"Running remote seed: {cmd_str}")
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            timeout=300  # 5 minute timeout
        )
        
        logger.info("Remote seed completed successfully")
        
        return {
            "success": True,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "command": cmd_str
        }
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Remote seed failed: {e.stderr}")
        
        return {
            "success": False,
            "stdout": e.stdout,
            "stderr": e.stderr,
            "command": cmd_str
        }
    except subprocess.TimeoutExpired as e:
        logger.error("Remote seed timed out")
        
        return {
            "success": False,
            "stdout": e.stdout.decode() if e.stdout else "",
            "stderr": "Command timed out after 300 seconds",
            "command": cmd_str
        }


def remote_healthcheck(ssh_host: str, url: str = "http://localhost:7000/health") -> dict[str, Any]:
    """
    Perform health check on remote server.
    
    Args:
        ssh_host: SSH host (user@hostname)
        url: Health check URL
        
    Returns:
        {
            "healthy": bool,
            "status_code": int | None,
            "response": str,
            "error": str | None
        }
    """
    cmd = [
        "ssh",
        ssh_host,
        f"curl -f -s -o /dev/null -w '%{{http_code}}' {url}"
    ]
    
    cmd_str = " ".join(cmd)
    logger.info(f"Health check: {cmd_str}")
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            timeout=30
        )
        
        status_code = int(result.stdout.strip())
        healthy = status_code == 200
        
        logger.info(f"Health check: status={status_code}, healthy={healthy}")
        
        return {
            "healthy": healthy,
            "status_code": status_code,
            "response": result.stdout,
            "error": None
        }
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Health check failed: {e.stderr}")
        
        return {
            "healthy": False,
            "status_code": None,
            "response": e.stdout,
            "error": e.stderr
        }
    except subprocess.TimeoutExpired:
        logger.error("Health check timed out")
        
        return {
            "healthy": False,
            "status_code": None,
            "response": "",
            "error": "Health check timed out after 30 seconds"
        }
    except ValueError as e:
        logger.error(f"Invalid health check response: {e}")
        
        return {
            "healthy": False,
            "status_code": None,
            "response": result.stdout if 'result' in locals() else "",
            "error": f"Invalid status code: {e}"
        }


def rollback_remote_current(ssh_host: str, media_root: str, previous_target: str) -> None:
    """
    Rollback the 'current' symlink to previous release.
    
    Args:
        ssh_host: SSH host (user@hostname)
        media_root: Remote media root path
        previous_target: Previous release name to rollback to
        
    Raises:
        subprocess.CalledProcessError: If command fails
    """
    if not previous_target:
        logger.warning("No previous target to rollback to")
        return
    
    logger.warning(f"Rolling back current -> {previous_target}")
    
    set_remote_current(ssh_host, media_root, previous_target)
    
    logger.info(f"Rolled back to {previous_target}")


def create_remote_releases_dir(ssh_host: str, media_root: str) -> None:
    """
    Ensure releases/ directory exists on remote server.
    
    Args:
        ssh_host: SSH host (user@hostname)
        media_root: Remote media root path
        
    Raises:
        subprocess.CalledProcessError: If command fails
    """
    releases_dir = f"{media_root}/releases"
    
    cmd = [
        "ssh",
        ssh_host,
        f"mkdir -p {releases_dir}"
    ]
    
    logger.info(f"Creating releases directory: {releases_dir}")
    
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        logger.info(f"Releases directory ready: {releases_dir}")
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to create releases directory: {e.stderr}")
        raise
