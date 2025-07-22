# RAG Evaluation Framework

A comprehensive framework for evaluating Retrieval Augmented Generation (RAG) systems using ground truth data and Claude AI analysis.

## Overview

This evaluation framework consists of three main components:

1. **Ground Truth Generation** (`groundtruth.py`) - Generates question-answer pairs from documents
2. **Claude Analysis** (`claude.py`) - Provides AI-powered qualitative analysis
3. **RAG Evaluation** (`eval.py`) - Evaluates RAG system performance with metrics and analysis

## Components

### GroundTruthGenerator

Generates ground truth data from documents using Claude AI to create question-answer pairs for evaluation.

**Features:**
- Supports HTML, PDF, TXT, MD, CSV files
- Generates document summaries and Q&A pairs
- Batch processing for multiple documents
- Customizable prompts

### ClaudeClient

Provides interface to Claude AI for document analysis and evaluation.

**Features:**
- Multiple Claude model support
- Token counting and optimization
- File analysis with various formats
- HTML text extraction using BeautifulSoup

### RagEvaluator

Evaluates RAG system performance using similarity scores and qualitative analysis.

**Features:**
- Quantitative metrics (similarity scores, pass rates)
- Qualitative analysis using Claude AI
- Detailed reporting and recommendations
- Per-question and overall analysis

## Setup

### Prerequisites

1. **Environment Variables**
   ```bash
   # Add to your .env file or environment
   ANTHROPIC_API_KEY=your_api_key_here
   ```

2. **Dependencies**
   The framework requires these packages (should be installed via the main project requirements):
   - `anthropic` - Claude AI client
   - `numpy` - Numerical computations
   - `beautifulsoup4` - HTML parsing
   - `python-dotenv` - Environment variable loading

## Usage

### 1. Generate Ground Truth Data

#### Command Line Interface (Recommended)

The groundtruth generator is integrated into the main Gaia CLI:

```bash
# Process a single file
gaia-cli groundtruth -f ./data/html/blender/introduction.html

# Process all HTML files in a directory
gaia-cli groundtruth -d ./data/html/blender

# Process with custom output directory
gaia-cli groundtruth -f ./data/html/intro.html -o ./output/gt

# Process with custom file pattern (e.g., PDFs)
gaia-cli groundtruth -d ./data -p "*.pdf" -o ./output/gt

# Use custom Claude model
gaia-cli groundtruth -f ./data/doc.html -m claude-3-opus-20240229

# Use custom prompt from file
gaia-cli groundtruth -f ./data/doc.html --custom-prompt ./prompts/my_prompt.txt

# Process without saving extracted text
gaia-cli groundtruth -f ./data/doc.html --no-save-text

# Generate 10 Q&A pairs per document
gaia-cli groundtruth -d ./data/html/blender --num-samples 10
```

**Command Line Options:**
- `-f, --file`: Process a single document file
- `-d, --directory`: Process all matching files in a directory
- `-o, --output-dir`: Output directory (default: `./output/groundtruth`)
- `-p, --pattern`: File pattern for directory processing (default: `*.html`)
- `-m, --model`: Claude model to use (default: `claude-3-7-sonnet-20250219`)
- `--max-tokens`: Maximum tokens for responses (default: 4096)
- `--num-samples`: Number of Q&A pairs to generate per document (default: 5)
- `--no-save-text`: Don't save extracted text for HTML files
- `--custom-prompt`: Path to file containing custom prompt

> **Note**: You can also run the groundtruth generator as a standalone module with `python -m gaia.eval.groundtruth` if preferred.

#### Python API

You can also use the generator programmatically:

```python
from gaia.eval.groundtruth import GroundTruthGenerator

# Initialize generator
generator = GroundTruthGenerator()

# Generate for single document
result = generator.generate(
    file_path="./data/html/blender/introduction.html",
    output_dir="./output/groundtruth"
)

# Batch process multiple documents
results = generator.generate_batch(
    input_dir="./data/html/blender",
    file_pattern="*.html",
    output_dir="./output/groundtruth"
)
```

**Output**: Creates `.groundtruth.json` files containing:
- Document metadata
- Document summary
- Q&A pairs for evaluation

### 2. Create Results Template (Optional)

For manual testing, you can create a template file that structures the ground truth data for easy copy-paste of responses:

```bash
# Create template from ground truth file
gaia-cli create-template -f ./output/groundtruth/introduction.groundtruth.json

# Create template with custom output directory
gaia-cli create-template -f ./output/groundtruth/doc.groundtruth.json -o ./templates/

# Create template with custom similarity threshold
gaia-cli create-template -f ./output/groundtruth/doc.groundtruth.json --threshold 0.8
```

This creates a template file with placeholder responses that you can manually fill in:

```json
{
  "metadata": {
    "test_file": "path/to/groundtruth.json",
    "timestamp": "2025-01-XX XX:XX:XX",
    "similarity_threshold": 0.7,
    "instructions": "Fill in the 'response' fields with your RAG system outputs, then evaluate using gaia-cli eval"
  },
  "analysis": {
    "qa_results": [
      {
        "query": "What is Blender?",
        "ground_truth": "Blender is a free and open-source 3D...",
        "response": "[FILL IN YOUR RAG SYSTEM RESPONSE FOR QUESTION 1]",
        "similarity": 0.0
      }
    ]
  }
}
```

### 3. Run Your RAG System

Test your RAG system against the generated ground truth data. You can either:

**Option A: Use the template (for manual testing)**
1. Use `gaia-cli create-template` to generate a template file
2. Fill in the `response` fields with your RAG system outputs
3. Proceed to evaluation

**Option B: Generate results programmatically**
Your results should be saved in JSON format with this structure:

```json
{
  "metadata": {
    "test_file": "path/to/groundtruth.json",
    "timestamp": "2025-01-XX XX:XX:XX",
    "similarity_threshold": 0.7
  },
  "analysis": {
    "qa_results": [
      {
        "query": "What is Blender?",
        "ground_truth": "Blender is a free and open-source 3D...",
        "response": "Blender is a 3D modeling software...",
        "similarity": 0.85
      }
    ]
  }
}
```

### 4. Evaluate Results

Analyze your RAG system's performance:

```python
from gaia.eval.eval import RagEvaluator

# Initialize evaluator
evaluator = RagEvaluator(model="claude-3-7-sonnet-20250219")

# Generate comprehensive evaluation
evaluation_data = evaluator.generate_enhanced_report(
    results_path="./output/rag/results.json",
    output_dir="./output/eval"
)

# Print key metrics
print("Overall Rating:", evaluation_data['overall_rating']['rating'])
print("Pass Rate:", evaluation_data['overall_rating']['metrics']['pass_rate'])
```

## File Structure

```
output/
├── groundtruth/          # Generated ground truth data
│   └── *.groundtruth.json
├── templates/            # Template files for manual testing
│   └── *.template.json
├── rag/                  # RAG system results
│   └── *.results.json
└── eval/                 # Evaluation reports
    └── *.eval.json
```

## Evaluation Metrics

### Quantitative Metrics
- **Similarity Scores**: Cosine similarity between responses and ground truth
- **Pass Rate**: Percentage of responses above similarity threshold
- **Statistical Analysis**: Mean, median, min, max, standard deviation

### Qualitative Analysis (Claude AI)
- **Correctness**: Factual accuracy assessment
- **Completeness**: Coverage of the question
- **Conciseness**: Appropriate brevity
- **Relevance**: Direct addressing of the query

### Overall Ratings
- **Excellent**: Pass rate ≥90%, Mean similarity ≥0.8
- **Good**: Pass rate ≥80%, Mean similarity ≥0.7
- **Fair**: Pass rate ≥60%, Mean similarity ≥0.6
- **Poor**: Below fair thresholds

## Example Workflow

1. **Prepare Documents**
   ```bash
   # Place documents in data directory
   data/html/blender/introduction.html
   ```

2. **Generate Ground Truth**
   ```bash
   # Using Gaia CLI (recommended) - generates 5 Q&A pairs per document by default
   gaia-cli groundtruth -d ./data/html/blender -o ./output/groundtruth

   # Generate 10 Q&A pairs per document
   gaia-cli groundtruth -d ./data/html/blender -o ./output/groundtruth --num-samples 10

   # Or using standalone module
   # python -m gaia.eval.groundtruth -d ./data/html/blender -o ./output/groundtruth --num-samples 10

   # Or using Python API
   # generator = GroundTruthGenerator()
   # generator.generate_batch("./data/html/blender", output_dir="./output/groundtruth", num_samples=10)
   ```

3. **Create Template (For Manual Testing)**
   ```bash
   # Create template file for manual response entry
   gaia-cli create-template -f ./output/groundtruth/introduction.groundtruth.json -o ./output/templates
   ```

4. **Test RAG System**
   ```bash
   # Option A: Fill in template file manually with your RAG responses
   # Edit ./output/templates/introduction.template.json

   # Option B: Generate results programmatically
   # Your RAG system should process the ground truth and save results
   # Results format: see section "3. Run Your RAG System" above
   ```

5. **Evaluate Performance**
   ```python
   evaluator = RagEvaluator()
   evaluation = evaluator.generate_enhanced_report(
       "./output/templates/introduction.template.json",  # or your results file
       "./output/eval"
   )
   ```

## Error Handling

The framework includes robust error handling:

- **API Overload**: Falls back to raw data when Claude API is overloaded
- **File Not Found**: Clear error messages for missing files
- **JSON Parsing**: Graceful handling of malformed responses
- **Token Limits**: Automatic token counting and optimization

## Best Practices

1. **Similarity Threshold**: Start with 0.7, adjust based on your use case
2. **Model Selection**: Use latest Claude models for better analysis
3. **Batch Processing**: Process multiple documents together for efficiency
4. **Output Organization**: Use consistent directory structure for outputs
5. **Token Management**: Monitor token usage for cost optimization

## Command Line Help

Get detailed usage information:

```bash
# Show help and all available options for groundtruth
gaia-cli groundtruth --help

# Show help for template creation
gaia-cli create-template --help

# Show help for all Gaia CLI commands
gaia-cli --help

# Examples are included in the help output
gaia-cli groundtruth -h
gaia-cli create-template -h
```

## Troubleshooting

**Common Issues:**

1. **Missing API Key**: Ensure `ANTHROPIC_API_KEY` is set in environment
2. **File Format**: Check supported formats (HTML, PDF, TXT, MD, CSV)
3. **JSON Structure**: Verify RAG results match expected format
4. **Token Limits**: Use appropriate max_tokens for your model
5. **File Permissions**: Ensure read access to input files and write access to output directory
6. **Module Import**: Use `gaia-cli groundtruth` (recommended) or run from project root: `python -m gaia.eval.groundtruth`

**Template Issues:**
6. **Empty Template**: Ensure ground truth file contains QA pairs in the expected format
7. **Invalid Field Names**: Template uses 'query' and 'ground_truth' - verify your ground truth structure

**Debug Mode:**
Enable detailed logging by setting log level to DEBUG in your application.