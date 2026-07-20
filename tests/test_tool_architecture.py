import pytest
import os
import yaml
import time
from fastapi.testclient import TestClient
from server.main import app, get_tool_registry
import server.main as main_module

client = TestClient(app)

def test_tool_registry_cache_and_reload(tmp_path, monkeypatch):
    # Mock the path to tools.yaml to a temporary directory
    mock_tools_path = tmp_path / "tools.yaml"
    
    # Create a fake tool registry
    fake_tools = {
        "tools": [
            {
                "keywords": ["test_keyword"],
                "few_shot": "Test few shot",
                "schema": {"type": "function", "function": {"name": "test_tool"}}
            }
        ]
    }
    
    with open(mock_tools_path, "w") as f:
        yaml.dump(fake_tools, f)
        
    # Monkeypatch the path in main.py
    monkeypatch.setattr(main_module.os.path, "dirname", lambda x: str(tmp_path))
    
    # Force reset cache
    main_module._tool_cache = None
    main_module._tool_cache_mtime = 0
    
    # First load - should read from disk
    tools_1 = get_tool_registry()
    assert len(tools_1) == 1
    assert tools_1[0]["keywords"] == ["test_keyword"]
    
    # Second load - should read from cache (mtime hasn't changed)
    # We can verify it's the exact same object in memory
    tools_2 = get_tool_registry()
    assert tools_1 is tools_2
    
    # Modify the file
    time.sleep(0.01) # Ensure mtime changes
    fake_tools["tools"].append({
        "keywords": ["another_keyword"],
        "few_shot": "Another few shot",
        "schema": {"type": "function", "function": {"name": "another_tool"}}
    })
    
    with open(mock_tools_path, "w") as f:
        yaml.dump(fake_tools, f)
        
    # Third load - should detect mtime change and reload
    tools_3 = get_tool_registry()
    assert len(tools_3) == 2
    assert tools_3 is not tools_1 # New object in memory

def test_nlp_tool_gating_strips_tools(monkeypatch):
    # Mock litellm to intercept kwargs
    intercepted_kwargs = {}
    
    class MockResponse:
        class Choice:
            class Message:
                content = "Mocked reply"
            message = Message()
        choices = [Choice()]
        usage = None

    def mock_completion(**kwargs):
        nonlocal intercepted_kwargs
        intercepted_kwargs = kwargs
        return MockResponse()
        
    monkeypatch.setattr(main_module.litellm, "completion", mock_completion)
    
    # Send a chat request with NO tool keywords
    req_data = {
        "messages": [{"role": "user", "content": "Hello Verdant, how are you today?"}],
        "model_name": "test-model"
    }
    
    res = client.post("/api/chat", json=req_data)
    assert res.status_code == 200
    
    # Verify that 'tools' was NOT included in the kwargs sent to the LLM
    assert "tools" not in intercepted_kwargs
    
    # Verify the few-shot examples were NOT injected into the prompt
    system_prompt = intercepted_kwargs["messages"][0]["content"]
    assert "TOOL CALLING EXAMPLES" not in system_prompt

def test_nlp_tool_gating_injects_tools(monkeypatch):
    # Mock litellm to intercept kwargs
    intercepted_kwargs = {}
    
    class MockResponse:
        class Choice:
            class Message:
                content = "Mocked reply"
            message = Message()
        choices = [Choice()]
        usage = None

    def mock_completion(**kwargs):
        nonlocal intercepted_kwargs
        intercepted_kwargs = kwargs
        return MockResponse()
        
    monkeypatch.setattr(main_module.litellm, "completion", mock_completion)
    
    # Send a chat request WITH a tool keyword ("night" triggers set_lighting)
    req_data = {
        "messages": [{"role": "user", "content": "Make it night time please"}],
        "model_name": "test-model"
    }
    
    res = client.post("/api/chat", json=req_data)
    assert res.status_code == 200
    
    # Verify that 'tools' WAS included in the kwargs
    assert "tools" in intercepted_kwargs
    assert len(intercepted_kwargs["tools"]) > 0
    
    # Verify the specific tool schema was injected
    tool_names = [t["function"]["name"] for t in intercepted_kwargs["tools"]]
    assert "set_lighting" in tool_names
    
    # Verify the few-shot example WAS injected into the system prompt
    system_prompt = intercepted_kwargs["messages"][0]["content"]
    assert "TOOL CALLING EXAMPLES" in system_prompt
    assert "It's too bright, can you make it night?" in system_prompt
