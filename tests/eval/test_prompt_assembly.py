import sys
import os
import pytest

# Add the project root to the python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from server.main import assemble_prompt

@pytest.mark.tier1
def test_semantic_imhof_retrieval():
    """Test that a request for Imhof style successfully retrieves and injects the specific semantic lighting rules."""
    assembled, _ = assemble_prompt("I want to draw a map in the style of Eduard Imhof.", False)
    assert "warm (pale yellow/orange)" in assembled, "Failed to retrieve Imhof NW lighting rules"
    assert "cool (blue/violet)" in assembled, "Failed to retrieve Imhof SE shadow rules"

@pytest.mark.tier1
def test_semantic_fantasy_retrieval():
    """Test that Tolkien fantasy requests inject the specific topological rendering rules."""
    assembled, _ = assemble_prompt("Give me a high-fantasy Tolkien style map.", False)
    assert "caterpillar' ridges" in assembled, "Failed to retrieve Tolkien mountain rules"
    assert "concentric horizontal 'waterline' hatching" in assembled, "Failed to retrieve Tolkien coastline rules"

@pytest.mark.tier1
def test_episodic_brand_injection():
    """Test that the brand identity is injected when specifically requested."""
    assembled, neg = assemble_prompt("Draw the main workshop table. Use the verdant brand identity.", False)
    assert "rich polished mahogany wood" in assembled, "Failed to inject Episodic Brand constraints"
    assert "dark mode" in assembled

@pytest.mark.tier1
def test_working_topology_injection():
    """Test that basic topology tokens are injected during exploratory map rendering."""
    assembled, neg = assemble_prompt("Let's test some terrain layout ideas.", True)
    assert "bathymetric rendering" in assembled, "Failed to inject working topology tokens for maps"
    assert "isoline topography" in assembled
    assert "low quality" in neg, "Exploratory negative prompt should be relaxed"

@pytest.mark.tier1
def test_negative_constraints_one_shot():
    """Test that rigid negative constraints are applied for non-exploratory one-shot generation."""
    _, neg = assemble_prompt("Generate the final production asset.", False)
    assert "device frames" in neg, "One-shot generation missing rigid negative constraints"
    assert "UI overlays" in neg
