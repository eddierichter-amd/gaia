# Batch Experiment Configuration Examples

This directory contains example configurations for running batch experiments on transcript data. These configurations are specifically designed for **transcript summarization** experiments but can be adapted for Q&A tasks.

## Available Configurations

### 1. `basic_summarization.json`
**Purpose**: Simple, single-model summarization
**Best for**: Getting started, basic summarization needs
**Models**: Claude Sonnet 4
**Features**:
- Clear, structured summarization prompt
- Moderate token limit (1024)
- Low temperature for consistency

**Usage**:
```bash
gaia batch-experiment -c src/gaia/eval/configs/basic_summarization.json -i ./transcripts -o ./results
```

### 2. `multi_model_comparison.json`
**Purpose**: Compare different Claude model performance
**Best for**: Model selection, cost vs quality analysis
**Models**: Haiku (fast/cheap), Sonnet (balanced), Opus (detailed/expensive)
**Features**:
- Same task, different models
- Optimized prompts and token limits per model
- Cost vs quality comparison

**Usage**:
```bash
gaia batch-experiment -c src/gaia/eval/configs/multi_model_comparison.json -i ./transcripts -o ./results
```

### 3. `summary_styles.json`
**Purpose**: Explore different summarization approaches
**Best for**: Finding the right summary style for your use case
**Models**: Claude Sonnet 4 (consistent model, varying approaches)
**Features**:
- **Executive Summary**: High-level, C-suite focused
- **Action Items**: Task and outcome focused
- **Narrative**: Story-telling approach
- **Technical Notes**: Detailed technical documentation
- **Creative Insights**: Analytical with strategic insights

**Usage**:
```bash
gaia batch-experiment -c src/gaia/eval/configs/summary_styles.json -i ./transcripts -o ./results
```

### 4. `comprehensive_analysis.json`
**Purpose**: Full analysis across models and approaches
**Best for**: Complete evaluation, research, thorough comparison
**Models**: Claude Haiku, Sonnet, Opus + Local Lemonade
**Features**:
- Standard analysis vs deep analysis
- Cloud vs local model comparison
- Stakeholder-focused perspective
- Wide range of analytical approaches

**Usage**:
```bash
gaia batch-experiment -c src/gaia/eval/configs/comprehensive_analysis.json -i ./transcripts -o ./results
```

## How to Use These Configurations

### Basic Workflow
```bash
# 1. Choose a configuration
CONFIG="src/gaia/eval/configs/basic_summarization.json"

# 2. Run experiments on your transcript data
gaia batch-experiment -c $CONFIG -i ./your_transcripts -o ./results

# 3. Evaluate results (optional)
gaia eval -f ./results/Claude-Sonnet-Basic-Summary.experiment.json

# 4. Generate comparative report
gaia report -d ./results
```

### Advanced Workflow with Custom Questions
If you have existing groundtruth data with custom questions:

```bash
# Use questions from groundtruth for Q&A experiments
gaia batch-experiment -c $CONFIG -i ./transcripts -q ./groundtruth/meeting.qa.json -o ./results
```

### Creating Custom Configurations

You can modify these configurations or create your own:

1. **Copy an existing config**: Start with the closest match to your needs
2. **Modify system prompts**: Adjust the analysis focus and style
3. **Adjust parameters**:
   - `max_tokens`: Higher for detailed summaries (1024-2048)
   - `temperature`: Lower (0.0-0.1) for consistency, higher (0.3-0.7) for creativity
   - `model`: Choose based on cost/quality needs
4. **Add experiments**: Include multiple variations to compare approaches

### Configuration Structure

```json
{
  "description": "Human-readable description of the config purpose",
  "experiments": [
    {
      "name": "Unique-Experiment-Name",
      "llm_type": "claude",  // or "lemonade"
      "model": "claude-sonnet-4-20250514",
      "experiment_type": "summarization",  // or "qa"
      "system_prompt": "Detailed instructions for the LLM...",
      "max_tokens": 1024,
      "temperature": 0.1,
      "parameters": {}  // Additional model-specific parameters
    }
  ]
}
```

## Tips for Effective Summarization Experiments

### System Prompt Best Practices
- **Be specific** about the desired output format
- **Define the role** (meeting analyst, executive assistant, etc.)
- **Structure the task** with numbered sections or clear expectations
- **Include context** about the audience or use case

### Token Allocation Guidelines
- **Executive summaries**: 512-768 tokens
- **Standard summaries**: 1024 tokens
- **Detailed analysis**: 1536-2048 tokens
- **Technical documentation**: 1536+ tokens

### Temperature Guidelines
- **Factual summarization**: 0.0-0.1
- **Structured analysis**: 0.1-0.2
- **Creative insights**: 0.3-0.6
- **Brainstorming**: 0.6-0.8

### Model Selection Guidelines
- **Claude Haiku**: Fast, cost-effective, good for basic summaries
- **Claude Sonnet**: Balanced performance, good for most use cases
- **Claude Opus**: Highest quality, best for complex analysis
- **Local Lemonade**: Privacy-focused, good for sensitive content

## Getting Started

1. **Start simple**: Use `basic_summarization.json` for your first experiment
2. **Compare models**: Try `multi_model_comparison.json` to understand cost/quality tradeoffs
3. **Explore styles**: Use `summary_styles.json` to find your preferred approach
4. **Go comprehensive**: Use `comprehensive_analysis.json` for thorough evaluation

## Support

For questions about these configurations or creating custom ones:
- Check the main documentation in `src/gaia/eval/README.md`
- Run `gaia batch-experiment --help` for command options
- Use `gaia batch-experiment --create-sample-config` to generate templates