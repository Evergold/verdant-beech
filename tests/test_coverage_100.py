import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
import httpx
import os
import yaml

from server.main import (
    app, auto_setup_models, on_startup, get_setup_status,
    generate_default_projects, ensure_projects_yaml,
    load_projects, save_projects, compact_memory
)

client = TestClient(app)

@pytest.mark.asyncio
async def test_auto_setup_models_success():
    # Test lines 40-59
    mock_resp = AsyncMock()
    # Provide a mock async generator for aiter_lines
    async def mock_aiter_lines():
        yield '{"status": "downloading", "completed": 100}'
        yield 'invalid json'
    mock_resp.aiter_lines = mock_aiter_lines

    mock_client = AsyncMock()
    mock_client.stream.return_value.__aenter__.return_value = mock_resp

    with patch("server.main.httpx.AsyncClient", return_value=mock_client):
        await auto_setup_models()

@pytest.mark.asyncio
async def test_auto_setup_models_error():
    # Test lines 57 (Exception)
    with patch("server.main.httpx.AsyncClient", side_effect=Exception("Test Error")):
        await auto_setup_models()

@pytest.mark.asyncio
async def test_on_startup():
    # Test lines 63-64
    with patch("server.main.asyncio.create_task") as mock_task:
        await on_startup()
        mock_task.assert_called()

def test_get_setup_status():
    # Test line 68
    res = client.get("/api/setup/status")
    assert res.status_code == 200

def test_yaml_persistence(tmp_path):
    # Test 135-136, 149-150, 159, 161-162, 165-166
    test_yaml = tmp_path / "test_proj.yaml"
    
    with patch("server.main.PROJECTS_YAML_PATH", str(test_yaml)):
        # 1. ensure_projects_yaml creates it
        ensure_projects_yaml()
        assert os.path.exists(test_yaml)
        
        # 2. load_projects loads it
        data = load_projects()
        assert "projects" in data
        
        # 3. load_projects returns default if empty
        with open(test_yaml, "w") as f:
            f.write("")
        assert "projects" in load_projects()
        
        # 4. load_projects returns default if error
        with open(test_yaml, "w") as f:
            f.write("invalid: yaml: :")
        assert "projects" in load_projects()
        
        # 5. save_projects writes it
        save_projects({"projects": {}, "active_project": "123"})
        data2 = load_projects()
        assert data2["active_project"] == "123"

@patch("server.main.load_projects")
@patch("server.main.save_projects")
def test_project_api_not_found_branches(mock_save, mock_load):
    # Test 229, 247, 259, 273 (Project not found edge cases)
    mock_load.return_value = {
        "active_project": "missing_active",
        "projects": {}
    }
    
    # Rename project with missing active project
    res = client.post("/api/projects/rename", json={"name": "test"})
    assert res.json().get("error") == "Project not found"
    
    # Delete non-existent project
    res = client.delete("/api/projects/nonexistent")
    assert res.json().get("error") == "Project not found"
    
    # State update on non-existent project
    res = client.post("/api/projects/state", json={"key": "k", "value": "v"})
    assert res.json().get("error") == "Active project not found"

    # Delete project when active_project == project_id, ensuring active_project is reassigned
    mock_load.return_value = {
        "active_project": "proj1",
        "projects": {
            "proj1": {"name": "p1"},
            "proj2": {"name": "p2"}
        }
    }
    with patch("server.main.rag_store"):
        res = client.delete("/api/projects/proj1")
        assert res.status_code == 200

@patch("server.main.load_projects")
@patch("server.main.save_projects")
def test_project_name_increment(mock_save, mock_load):
    # Test 186-187
    mock_load.return_value = {
        "active_project": "proj1",
        "projects": {
            "proj1": {"name": "New Proj", "selectedModel": "gemma", "chroma_collection": "memory_proj1"},
            "proj2": {"name": "New Proj 2", "selectedModel": "gemma", "chroma_collection": "memory_proj2"}
        }
    }
    res = client.post("/api/projects", json={"name": "New Proj"})
    assert res.status_code == 200
    assert "New Proj 3" in str(mock_save.call_args)

@pytest.mark.asyncio
async def test_compact_memory_edge_cases():
    # Test 288 (empty messages)
    await compact_memory("test", [], "model")
    
    # Test 318-319 (exception)
    with patch("litellm.acompletion", side_effect=Exception("LLM Error")):
        await compact_memory("test", [{"role": "user", "content": "hi"}], "model")

@patch("server.main.httpx.AsyncClient")
def test_ollama_errors(mock_client):
    # Test 654-655, 678-679
    mock_client_instance = AsyncMock()
    mock_client.return_value.__aenter__.return_value = mock_client_instance
    mock_client_instance.get.side_effect = Exception("Network Error")
    
    # Status error
    from server.main import ollama_status, ollama_unload
    import asyncio
    res1 = asyncio.run(ollama_status())
    assert res1.get("online") == False
    
    # Unload error
    res2 = asyncio.run(ollama_unload())
    assert res2.get("status") == "error"
