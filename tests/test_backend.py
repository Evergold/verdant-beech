# test_backend.py (c) 2026 Evergold <261058386+Evergold@users.noreply.github.com>
# Licensed under the MIT License (see LICENSE for details)

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
import httpx
import json

from server.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_get_models():
    response = client.get("/api/models")
    assert response.status_code == 200
    assert "assistant_models" in response.json()

@patch("server.main.yaml.safe_load")
def test_get_models_error(mock_safe_load):
    mock_safe_load.side_effect = Exception("YAML error")
    response = client.get("/api/models")
    assert response.status_code == 200
    assert "error" in response.json()

@patch("server.main.litellm.completion")
def test_chat_endpoint(mock_completion):
    mock_choice = MagicMock()
    mock_choice.message.content = "Hello there."
    mock_choice.message.tool_calls = []
    
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_completion.return_value = mock_response

    response = client.post("/api/chat", json={
        "messages": [{"role": "user", "content": "hi"}],
        "model_name": "gemini",
        "reasoning": "low"
    })
    
    assert response.status_code == 200
    assert response.json()["reply"] == "Hello there."
    assert response.json()["tool_calls"] == []

@patch("server.main.litellm.completion")
def test_chat_endpoint_with_tools(mock_completion):
    mock_tool = MagicMock()
    mock_tool.id = "call_123"
    mock_tool.function.name = "set_lighting"
    mock_tool.function.arguments = '{"time_of_day": "night"}'
    
    mock_choice = MagicMock()
    mock_choice.message.content = ""
    mock_choice.message.tool_calls = [mock_tool]
    
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_completion.return_value = mock_response

    response = client.post("/api/chat", json={
        "messages": [{"role": "user", "content": "make it night"}]
    })
    
    assert response.status_code == 200
    assert response.json()["reply"] == "I have updated the canvas as requested."
    assert len(response.json()["tool_calls"]) == 1
    assert response.json()["tool_calls"][0]["name"] == "set_lighting"

@patch("server.main.litellm.completion")
def test_chat_endpoint_error(mock_completion):
    mock_completion.side_effect = Exception("LLM error")
    response = client.post("/api/chat", json={
        "messages": [{"role": "user", "content": "hi"}]
    })
    assert response.json()["reply"] == "Error: LLM error"

def test_generate_map():
    response = client.post("/api/generate?prompt=forest")
    assert response.status_code == 200
    assert response.json() == {"status": "generation_started"}

@patch('server.main.httpx.AsyncClient')
def test_ollama_status(mock_async_client):
    mock_client_instance = AsyncMock()
    mock_async_client.return_value.__aenter__.return_value = mock_client_instance
    
    mock_resp1 = MagicMock()
    mock_resp1.json.return_value = {"models": [{"name": "test_tag"}]}
    mock_resp1.raise_for_status = MagicMock()
    
    mock_resp2 = MagicMock()
    mock_resp2.json.return_value = {"models": [{"name": "test_tag", "size_vram": 1024**3}]}
    
    mock_client_instance.get.side_effect = [mock_resp1, mock_resp2]
    
    with patch('server.main.subprocess.check_output') as mock_sub:
        mock_sub.return_value = b"llama-server 1048576"
        response = client.get("/api/ollama/status")
        
    assert response.status_code == 200
    assert response.json()["online"] == True
    assert response.json()["models"] == ["test_tag"]
    assert response.json()["vram_gb"] == 1.0
    assert response.json()["ram_gb"] == 1.0

@patch('server.main.httpx.AsyncClient')
def test_ollama_status_ps_error(mock_async_client):
    mock_client_instance = AsyncMock()
    mock_async_client.return_value.__aenter__.return_value = mock_client_instance
    
    mock_resp1 = MagicMock()
    mock_resp1.json.return_value = {"models": [{"name": "test_tag"}]}
    mock_resp1.raise_for_status = MagicMock()
    
    mock_resp2 = MagicMock()
    mock_resp2.json.return_value = {"models": [{"name": "test_tag", "size_vram": 1024**3}]}
    
    mock_client_instance.get.side_effect = [mock_resp1, mock_resp2]
    
    with patch('server.main.subprocess.check_output') as mock_sub:
        mock_sub.side_effect = Exception("ps failed")
        response = client.get("/api/ollama/status")
        
    assert response.status_code == 200
    assert response.json()["online"] == True
    assert response.json()["ram_gb"] == 0.0

@patch('server.main.httpx.AsyncClient')
def test_ollama_status_error(mock_async_client):
    mock_async_client.return_value.__aenter__.side_effect = Exception("Offline")
    response = client.get("/api/ollama/status")
    assert response.status_code == 200
    assert response.json()["online"] == False
    assert response.json()["error"] == "Offline"

@patch('server.main.httpx.AsyncClient')
def test_ollama_unload(mock_async_client):
    mock_client_instance = AsyncMock()
    mock_async_client.return_value.__aenter__.return_value = mock_client_instance
    
    mock_resp1 = MagicMock()
    mock_resp1.json.return_value = {"models": [{"name": "test_tag"}]}
    mock_client_instance.get.return_value = mock_resp1
    
    response = client.post("/api/ollama/unload")
    assert response.status_code == 200
    assert response.json()["status"] == "unloaded"
    mock_client_instance.post.assert_called_once()

@patch('server.main.httpx.AsyncClient')
def test_ollama_unload_error(mock_async_client):
    mock_async_client.return_value.__aenter__.side_effect = Exception("Offline")
    response = client.post("/api/ollama/unload")
    assert response.status_code == 200
    assert response.json()["status"] == "error"

@patch('server.main.httpx.AsyncClient')
def test_ollama_prewarm(mock_async_client):
    mock_client_instance = AsyncMock()
    mock_async_client.return_value.__aenter__.return_value = mock_client_instance
    
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_client_instance.post.return_value = mock_resp
    
    response = client.post("/api/ollama/prewarm", json={"model": "ollama_chat/gemma4"})
    assert response.status_code == 200
    assert response.json()["status"] == "warmed"

@patch('server.main.httpx.AsyncClient')
def test_ollama_prewarm_missing(mock_async_client):
    mock_client_instance = AsyncMock()
    mock_async_client.return_value.__aenter__.return_value = mock_client_instance
    
    mock_resp = MagicMock()
    mock_resp.status_code = 404
    mock_client_instance.post.return_value = mock_resp
    
    response = client.post("/api/ollama/prewarm", json={"model": "gemma4"})
    assert response.status_code == 200
    assert response.json()["status"] == "missing"

@patch('server.main.httpx.AsyncClient')
def test_ollama_prewarm_connect_error(mock_async_client):
    mock_client_instance = AsyncMock()
    mock_async_client.return_value.__aenter__.return_value = mock_client_instance
    
    mock_client_instance.post.side_effect = httpx.ConnectError("Offline")
    
    response = client.post("/api/ollama/prewarm", json={"model": "gemma4"})
    assert response.status_code == 200
    assert response.json()["status"] == "offline"

@patch('server.main.httpx.AsyncClient')
def test_ollama_prewarm_other_error(mock_async_client):
    mock_async_client.return_value.__aenter__.side_effect = Exception("Unknown")
    response = client.post("/api/ollama/prewarm", json={"model": "gemma4"})
    assert response.status_code == 200
    assert response.json()["status"] == "error"

def test_ollama_prewarm_ignored():
    response = client.post("/api/ollama/prewarm", json={})
    assert response.status_code == 200
    assert response.json()["status"] == "ignored"

# test catch_all dev and dist
def test_catch_all_dev():
    with patch('os.path.isdir') as mock_isdir:
        mock_isdir.return_value = False
        import importlib
        import server.main
        importlib.reload(server.main)
        client_reloaded = TestClient(server.main.app)
        
        response = client_reloaded.get("/some/random/path")
        assert response.status_code == 200
        assert "Frontend build not found" in response.text
        
def test_catch_all():
    response = client.get("/some/random/path")
    assert response.status_code == 200

@patch('server.main.httpx.AsyncClient')
@pytest.mark.asyncio
async def test_ollama_pull(mock_async_client):
    mock_client_instance = AsyncMock()
    mock_async_client.return_value.__aenter__.return_value = mock_client_instance
    
    mock_response = AsyncMock()
    async def mock_aiter_bytes():
        yield b'{"status": "pulling"}'
    mock_response.aiter_bytes = mock_aiter_bytes
    
    mock_stream_cm = MagicMock()
    mock_stream_cm.__aenter__ = AsyncMock(return_value=mock_response)
    mock_stream_cm.__aexit__ = AsyncMock(return_value=None)
    mock_client_instance.stream = MagicMock()
    mock_client_instance.stream.return_value = mock_stream_cm
    
    from server.main import ollama_pull
    from fastapi import Request
    
    mock_req = AsyncMock(spec=Request)
    mock_req.json.return_value = {"model": "gemma4"}
    
    resp = await ollama_pull(mock_req)
    assert resp.media_type == "application/x-ndjson"
    
    body = [chunk async for chunk in resp.body_iterator]
    assert body == [b'{"status": "pulling"}']

def test_ensure_models_yaml():
    with patch('os.path.exists') as mock_exists, patch('builtins.open', new_callable=MagicMock) as mock_open:
        mock_exists.return_value = False
        from server.main import ensure_models_yaml
        ensure_models_yaml()
        mock_open.assert_called_once()

@pytest.mark.asyncio
async def test_chat_endpoint_pre_injection_rag():
    """Test that the new Pre-Injection RAG adds context to the system prompt."""
    from pydantic import BaseModel
    
    class MockMessage(BaseModel):
        content: str | None = None
        tool_calls: list | None = None
        def model_dump(self):
            return {"role": "assistant", "content": self.content}
            
    class MockChoice:
        def __init__(self, message):
            self.message = message
            
    class MockResponse:
        def __init__(self, choices):
            self.choices = choices
            
    responses = [
        MockResponse([MockChoice(MockMessage(
            content="Based on the injected rules, lowlands should be desaturated green."
        ))])
    ]
    
    def mock_completion(*args, **kwargs):
        messages = kwargs.get("messages", [])
        # Verify the system prompt got injected with the cartography rule
        assert any("EXPERT CARTOGRAPHY RULES" in m["content"] for m in messages)
        assert any("Lowlands are green" in m["content"] for m in messages)
        return responses[0]
        
    with patch("server.main.litellm.completion", side_effect=mock_completion), \
         patch("server.main.rag_store.query", return_value=["Lowlands are green"]):
        response = client.post("/api/chat", json={
            "messages": [{"role": "user", "content": "What are the rules for elevation colors?"}],
            "model_name": "test_model"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["reply"] == "Based on the injected rules, lowlands should be desaturated green."

@patch('server.main.LIBRARY_DIR', new_callable=MagicMock)
def test_library_folders(mock_library_dir, tmp_path):
    import shutil
    import os
    
    # Use a temporary directory for the library
    temp_lib = str(tmp_path / "library")
    mock_library_dir.__str__.return_value = temp_lib
    
    # Instead of patching a string which can be tricky with os.path, we patch the module attribute
    with patch('server.main.LIBRARY_DIR', temp_lib):
        response = client.get("/api/library/folders")
        assert response.status_code == 200
        assert response.json().get("folders") == []
        
        response = client.post("/api/library/folders", json={"name": "test_portfolio_1"})
        assert response.status_code == 200
        assert response.json().get("status") == "success"
        
        # Test duplicate
        response2 = client.post("/api/library/folders", json={"name": "test_portfolio_1"})
        assert response2.json().get("error") == "Folder already exists"
        
        # Test invalid name
        response3 = client.post("/api/library/folders", json={"name": "bad/name"})
        assert response3.json().get("error") == "Invalid folder name"
        
        # Test list again
        response4 = client.get("/api/library/folders")
        assert response4.status_code == 200
        assert "test_portfolio_1" in response4.json().get("folders", [])

@pytest.mark.asyncio
@patch("litellm.acompletion")
async def test_compact_memory(mock_acompletion):
    from server.main import compact_memory
    
    # Mock LLM response
    mock_res = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "The user decided on a minimalist map of Mordor."
    mock_res.choices = [mock_choice]
    mock_acompletion.return_value = mock_res
    
    old_messages = [{"role": "user", "content": "Let's map Mordor."}]
    
    with patch("server.rag.rag_store") as mock_rag_store:
        mock_collection = MagicMock()
        mock_rag_store.client.get_or_create_collection.return_value = mock_collection
        
        await compact_memory("test_proj", old_messages, "test_model_123", 0, 10)
        
        # Verify litellm was called with the correct optimizations
        mock_acompletion.assert_called_once()
        kwargs = mock_acompletion.call_args.kwargs
        assert kwargs["model"] == "test_model_123"
        assert kwargs["reasoning_effort"] == "low"
        assert kwargs["drop_params"] is True
        
        # Verify negative prompting is in the context
        assert "CRITICAL INSTRUCTION" in kwargs["messages"][0]["content"]
        assert "<think>" in kwargs["messages"][0]["content"]
        
        # Verify the result was saved to ChromaDB
        mock_collection.upsert.assert_called_once()
        upsert_kwargs = mock_collection.upsert.call_args.kwargs
        assert upsert_kwargs["documents"] == ["The user decided on a minimalist map of Mordor."]
        assert upsert_kwargs["metadatas"][0]["type"] == "episodic_summary"
        assert upsert_kwargs["metadatas"][0]["start_idx"] == 0
        assert upsert_kwargs["metadatas"][0]["end_idx"] == 10
        assert "timestamp" in upsert_kwargs["metadatas"][0]
