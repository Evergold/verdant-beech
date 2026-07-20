# test_projects.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from server.main import app

client = TestClient(app)

@patch("server.main.load_projects")
@patch("server.main.save_projects")
def test_projects_crud(mock_save, mock_load):
    # Mock data
    mock_data = {
        "active_project": "proj1",
        "projects": {
            "proj1": {"name": "Test 1", "selectedModel": "gemma", "chroma_collection": "memory_proj1"}
        }
    }
    mock_load.return_value = mock_data

    # GET /api/projects
    res = client.get("/api/projects")
    assert res.status_code == 200
    assert res.json()["active_project"] == "proj1"

    # POST /api/projects
    res = client.post("/api/projects", json={"name": "New Proj", "model": "gemini"})
    assert res.status_code == 200
    assert "id" in res.json()
    mock_save.assert_called()

    # POST /api/projects/active
    res = client.post("/api/projects/active", json={"id": "proj1"})
    assert res.status_code == 200
    
    # POST /api/projects/active (Not found)
    res = client.post("/api/projects/active", json={"id": "nonexistent"})
    assert res.json().get("error") == "Project not found"

    # POST /api/projects/rename
    res = client.post("/api/projects/rename", json={"name": "Renamed Proj"})
    assert res.status_code == 200
    
    # POST /api/projects/rename (Duplicate)
    mock_data["projects"]["proj2"] = {"name": "Duplicate"}
    res = client.post("/api/projects/rename", json={"name": "Duplicate"})
    assert res.json().get("error") == "A project with this name already exists."

    # POST /api/projects/state
    res = client.post("/api/projects/state", json={"key": "test_key", "value": "test_val"})
    assert res.status_code == 200

    # DELETE /api/projects/{id}
    with patch("server.main.rag_store") as mock_rag:
        res = client.delete("/api/projects/proj2")
        assert res.status_code == 200
        
    # DELETE last project
    mock_data["projects"] = {"proj1": {"name": "Test 1"}}
    res = client.delete("/api/projects/proj1")
    assert res.status_code == 200
    assert "Untitled Project" in str(mock_save.call_args)
