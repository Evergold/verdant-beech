import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
import httpx
import os
import yaml
from contextlib import asynccontextmanager

from server.main import (
    app, auto_setup_models, on_startup, get_setup_status,
    generate_default_projects, ensure_projects_yaml,
    load_projects, save_projects, compact_memory
)

client = TestClient(app)

@pytest.mark.asyncio
async def test_auto_setup_models_success():
    class MockHttpxClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            pass
        @asynccontextmanager
        async def stream(self, *args, **kwargs):
            class MockResponse:
                async def aiter_lines(self):
                    yield '{"status": "downloading", "completed": 100}'
                    yield 'invalid json'
            yield MockResponse()

    with patch("server.main.httpx.AsyncClient", return_value=MockHttpxClient()):
        await auto_setup_models()

@pytest.mark.asyncio
async def test_auto_setup_models_error():
    with patch("server.main.httpx.AsyncClient", side_effect=Exception("Test Error")):
        await auto_setup_models()

@pytest.mark.asyncio
async def test_on_startup():
    with patch("server.main.asyncio.create_task") as mock_task:
        await on_startup()
        mock_task.assert_called()

def test_get_setup_status():
    res = client.get("/api/setup/status")
    assert res.status_code == 200

def test_yaml_persistence(tmp_path):
    test_yaml = tmp_path / "test_proj.yaml"
    
    with patch("server.main.PROJECTS_YAML_PATH", str(test_yaml)):
        ensure_projects_yaml()
        assert os.path.exists(test_yaml)
        
        data = load_projects()
        assert "projects" in data
        
        with open(test_yaml, "w") as f:
            f.write("")
        assert "projects" in load_projects()
        
        with open(test_yaml, "w") as f:
            f.write("invalid: yaml: :")
        assert "projects" in load_projects()
        
        save_projects({"projects": {}, "active_project": "123"})
        data2 = load_projects()
        assert data2["active_project"] == "123"

@patch("server.main.load_projects")
@patch("server.main.save_projects")
def test_project_api_not_found_branches(mock_save, mock_load):
    mock_load.return_value = {
        "active_project": "missing_active",
        "projects": {}
    }
    
    res = client.post("/api/projects/rename", json={"name": "test"})
    assert res.json().get("error") == "Project not found"
    
    res = client.delete("/api/projects/nonexistent")
    assert res.json().get("error") == "Project not found"
    
    res = client.post("/api/projects/state", json={"key": "k", "value": "v"})
    assert res.json().get("error") == "Active project not found"

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
    await compact_memory("test", [], "model")
    
    with patch("litellm.acompletion", side_effect=Exception("LLM Error")):
        await compact_memory("test", [{"role": "user", "content": "hi"}], "model")

@patch("server.main.httpx.AsyncClient")
def test_ollama_errors(mock_client):
    mock_client_instance = AsyncMock()
    mock_client.return_value.__aenter__.return_value = mock_client_instance
    mock_client_instance.get.side_effect = Exception("Network Error")
    
    from server.main import ollama_status, ollama_unload
    import asyncio
    res1 = asyncio.run(ollama_status())
    assert res1.get("online") == False
    
    res2 = asyncio.run(ollama_unload())
    assert res2.get("status") == "error"

@patch("server.main.litellm.completion")
def test_chat_episodic_memory_injection(mock_completion):
    mock_choice = MagicMock()
    mock_choice.message.content = "Response"
    mock_choice.message.tool_calls = []
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_completion.return_value = mock_response

    with patch("server.main.rag_store") as mock_rag:
        # Mock actual memory return
        mock_collection = MagicMock()
        mock_collection.query.return_value = {"documents": [["past memory 1"]]}
        mock_rag.client.get_or_create_collection.return_value = mock_collection
        
        res = client.post("/api/chat", json={
            "messages": [{"role": "user", "content": "hello"}],
            "project_id": "proj_mem"
        })
        assert res.status_code == 200
        # Line 477 should be executed, pushing context into the messages block
        assert "PAST CONVERSATIONAL MEMORY" in mock_completion.call_args.kwargs["messages"][0]["content"]

def test_library_exceptions():
    with patch("server.main.os.scandir", side_effect=Exception("Scandir Failed")):
        res = client.get("/api/library/folders")
        assert res.json().get("error") == "Scandir Failed"

    with patch("server.main.os.makedirs", side_effect=Exception("Makedirs Failed")):
        res = client.post("/api/library/folders", json={"name": "test_folder"})
        assert res.json().get("error") == "Makedirs Failed"
