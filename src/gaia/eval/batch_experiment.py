import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from gaia.logger import get_logger
from gaia.eval.claude import ClaudeClient
from gaia.llm.lemonade_client import LemonadeClient


@dataclass
class ExperimentConfig:
    """Configuration for a single experiment."""

    name: str
    llm_type: str  # "claude" or "lemonade"
    model: str
    system_prompt: str
    experiment_type: str = "qa"  # "qa" or "summarization"
    max_tokens: int = 512
    temperature: float = 0.7
    parameters: Dict[str, Any] = None

    def __post_init__(self):
        if self.parameters is None:
            self.parameters = {}
        if self.experiment_type not in ["qa", "summarization"]:
            raise ValueError(
                f"experiment_type must be 'qa' or 'summarization', got: {self.experiment_type}"
            )


class BatchExperimentRunner:
    """Run batch experiments with different LLM configurations on transcript data.

    Summarization experiments make independent LLM calls for each component
    (executive summary, detailed summary, action items, etc.) to produce
    natural, focused outputs without complex JSON formatting.
    """

    def __init__(self, config_file: str):
        self.log = get_logger(__name__)
        self.config_file = config_file
        self.experiments = []
        self.load_config()

    def load_config(self):
        """Load experiment configuration from JSON file."""
        try:
            with open(self.config_file, "r", encoding="utf-8") as f:
                config_data = json.load(f)

            # Validate config structure
            if "experiments" not in config_data:
                raise ValueError("Configuration file must contain 'experiments' array")

            # Parse experiments
            for exp_data in config_data["experiments"]:
                experiment = ExperimentConfig(
                    name=exp_data["name"],
                    llm_type=exp_data["llm_type"],
                    model=exp_data["model"],
                    system_prompt=exp_data["system_prompt"],
                    experiment_type=exp_data.get("experiment_type", "qa"),
                    max_tokens=exp_data.get("max_tokens", 512),
                    temperature=exp_data.get("temperature", 0.7),
                    parameters=exp_data.get("parameters", {}),
                )
                self.experiments.append(experiment)

            self.log.info(f"Loaded {len(self.experiments)} experiments from config")

        except Exception as e:
            self.log.error(f"Error loading config file: {e}")
            raise

    def create_llm_client(self, experiment: ExperimentConfig):
        """Create appropriate LLM client based on experiment config."""
        if experiment.llm_type.lower() == "claude":
            return ClaudeClient(
                model=experiment.model, max_tokens=experiment.max_tokens
            )
        elif experiment.llm_type.lower() == "lemonade":
            return LemonadeClient(
                model=experiment.model, verbose=False, **experiment.parameters
            )
        else:
            raise ValueError(f"Unsupported LLM type: {experiment.llm_type}")

    def process_question_claude(
        self, client: ClaudeClient, question: str, system_prompt: str
    ) -> Dict:
        """Process a question using Claude client."""
        try:
            prompt = f"{system_prompt}\n\nQuestion: {question}\n\nAnswer:"
            response_data = client.get_completion_with_usage(prompt)

            # Extract response text
            response = response_data["content"]
            if isinstance(response, list):
                response_text = (
                    response[0].text
                    if hasattr(response[0], "text")
                    else str(response[0])
                )
            else:
                response_text = (
                    response.text if hasattr(response, "text") else str(response)
                )

            return {
                "response": response_text.strip(),
                "usage": response_data["usage"],
                "cost": response_data["cost"],
                "error": None,
            }
        except Exception as e:
            self.log.error(f"Error processing question with Claude: {e}")
            return {
                "response": f"ERROR: {str(e)}",
                "usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
                "cost": {"input_cost": 0.0, "output_cost": 0.0, "total_cost": 0.0},
                "error": str(e),
            }

    def process_question_lemonade(
        self,
        client: LemonadeClient,
        question: str,
        system_prompt: str,
        max_tokens: int,
        temperature: float,
    ) -> Dict:
        """Process a question using Lemonade client."""
        try:
            # Format the prompt with system message and question
            formatted_prompt = f"{system_prompt}\n\nQuestion: {question}\n\nAnswer:"

            # Use completions method with the client's loaded model
            response_data = client.completions(
                model=client.model,  # Use model from experiment config
                prompt=formatted_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                stream=False,
            )

            # Extract text from the response
            response_text = ""
            if "choices" in response_data and response_data["choices"]:
                response_text = response_data["choices"][0].get("text", "")

            return {
                "response": response_text.strip(),
                "usage": {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                },  # Lemonade doesn't provide usage stats
                "cost": {"input_cost": 0.0, "output_cost": 0.0, "total_cost": 0.0},
                "error": None,
            }
        except Exception as e:
            self.log.error(f"Error processing question with Lemonade: {e}")
            return {
                "response": f"ERROR: {str(e)}",
                "usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
                "cost": {"input_cost": 0.0, "output_cost": 0.0, "total_cost": 0.0},
                "error": str(e),
            }

    def _get_summary_prompts(self, base_system_prompt: str) -> Dict[str, str]:
        """Generate individual prompts for each summary component."""
        return {
            "executive_summary": f"{base_system_prompt}\n\nProvide a brief executive summary (2-3 sentences) of the key outcomes and decisions from this transcript:",
            "detailed_summary": f"{base_system_prompt}\n\nProvide a detailed summary of the transcript, covering all major topics, discussions, and outcomes in paragraph form:",
            "action_items": f"{base_system_prompt}\n\nList the specific action items that were assigned during this meeting. Include who is responsible for each item when mentioned. Provide as a simple list:",
            "key_decisions": f"{base_system_prompt}\n\nList the key decisions that were made during this meeting. Focus on concrete decisions and outcomes. Provide as a simple list:",
            "participants": f"{base_system_prompt}\n\nList the participants mentioned in this transcript. Include their roles or titles when available. Provide as a simple list:",
            "topics_discussed": f"{base_system_prompt}\n\nList the main topics and subjects that were discussed in this meeting. Provide as a simple list:",
        }

    def process_summarization_claude(
        self, client: ClaudeClient, transcript: str, system_prompt: str
    ) -> Dict:
        """Process summarization by making independent calls for each component."""
        try:
            summary_prompts = self._get_summary_prompts(system_prompt)
            self.log.info(
                f"Processing summarization with {len(summary_prompts)} independent calls"
            )
            results = {}
            total_usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
            total_cost = {"input_cost": 0.0, "output_cost": 0.0, "total_cost": 0.0}
            errors = []

            for component, prompt_template in summary_prompts.items():
                try:
                    # Create full prompt with transcript
                    full_prompt = (
                        f"{prompt_template}\n\nTranscript:\n{transcript}\n\nResponse:"
                    )

                    response_data = client.get_completion_with_usage(full_prompt)

                    # Extract response text
                    response = response_data["content"]
                    if isinstance(response, list):
                        response_text = (
                            response[0].text
                            if hasattr(response[0], "text")
                            else str(response[0])
                        )
                    else:
                        response_text = (
                            response.text
                            if hasattr(response, "text")
                            else str(response)
                        )

                    results[component] = response_text.strip()

                    # Accumulate usage and cost
                    if response_data["usage"]:
                        for key in total_usage:
                            total_usage[key] += response_data["usage"].get(key, 0)
                    if response_data["cost"]:
                        for key in total_cost:
                            total_cost[key] += response_data["cost"].get(key, 0.0)

                    # Small delay between component calls to avoid rate limiting
                    time.sleep(0.5)

                except Exception as e:
                    self.log.error(f"Error processing {component} with Claude: {e}")
                    results[component] = f"ERROR: {str(e)}"
                    errors.append(f"{component}: {str(e)}")

            return {
                "response": results,
                "usage": total_usage,
                "cost": total_cost,
                "error": "; ".join(errors) if errors else None,
            }
        except Exception as e:
            self.log.error(f"Error in independent summarization with Claude: {e}")
            return {
                "response": f"ERROR: {str(e)}",
                "usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
                "cost": {"input_cost": 0.0, "output_cost": 0.0, "total_cost": 0.0},
                "error": str(e),
            }

    def process_summarization_lemonade(
        self,
        client: LemonadeClient,
        transcript: str,
        system_prompt: str,
        max_tokens: int,
        temperature: float,
    ) -> Dict:
        """Process summarization by making independent calls for each component."""
        try:
            summary_prompts = self._get_summary_prompts(system_prompt)
            self.log.info(
                f"Processing summarization with {len(summary_prompts)} independent calls"
            )
            results = {}
            total_usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
            total_cost = {"input_cost": 0.0, "output_cost": 0.0, "total_cost": 0.0}
            errors = []

            for component, prompt_template in summary_prompts.items():
                try:
                    # Create full prompt with transcript
                    full_prompt = (
                        f"{prompt_template}\n\nTranscript:\n{transcript}\n\nResponse:"
                    )

                    response_data = client.completions(
                        model=client.model,
                        prompt=full_prompt,
                        max_tokens=max_tokens,
                        temperature=temperature,
                        stream=False,
                    )

                    # Extract text from the response
                    response_text = ""
                    if "choices" in response_data and response_data["choices"]:
                        response_text = response_data["choices"][0].get("text", "")

                    results[component] = response_text.strip()

                    # Small delay between component calls to avoid rate limiting
                    time.sleep(0.5)

                except Exception as e:
                    self.log.error(f"Error processing {component} with Lemonade: {e}")
                    results[component] = f"ERROR: {str(e)}"
                    errors.append(f"{component}: {str(e)}")

            return {
                "response": results,
                "usage": total_usage,  # Lemonade doesn't provide usage stats
                "cost": total_cost,
                "error": "; ".join(errors) if errors else None,
            }
        except Exception as e:
            self.log.error(f"Error in independent summarization with Lemonade: {e}")
            return {
                "response": f"ERROR: {str(e)}",
                "usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
                "cost": {"input_cost": 0.0, "output_cost": 0.0, "total_cost": 0.0},
                "error": str(e),
            }

    def load_data_from_source(
        self, input_path: str, experiment_type: str = "qa", queries_source: str = None
    ) -> List[Dict]:
        """Load data from various input sources: groundtruth files, transcript files, or directories."""
        input_path = Path(input_path)

        try:
            if input_path.is_file():
                if input_path.suffix == ".json":
                    # Handle groundtruth JSON files
                    return self._load_from_groundtruth_file(
                        str(input_path), experiment_type
                    )
                else:
                    # Handle individual transcript files
                    return self._load_from_transcript_file(
                        str(input_path), experiment_type, queries_source
                    )
            elif input_path.is_dir():
                # Handle directories of transcript files
                return self._load_from_transcript_directory(
                    str(input_path), experiment_type, queries_source
                )
            else:
                raise FileNotFoundError(f"Input path not found: {input_path}")

        except Exception as e:
            self.log.error(f"Error loading data from source: {e}")
            raise

    def _load_queries_from_groundtruth(self, groundtruth_file: str) -> List[str]:
        """Extract queries from a groundtruth file for use with raw transcripts."""
        with open(groundtruth_file, "r", encoding="utf-8") as f:
            groundtruth_data = json.load(f)

        analysis = groundtruth_data.get("analysis", {})
        qa_pairs = analysis.get("qa_pairs", [])

        if not qa_pairs:
            raise ValueError(
                f"No QA pairs found in groundtruth file: {groundtruth_file}"
            )

        queries = []
        for qa_pair in qa_pairs:
            query = qa_pair.get("query", qa_pair.get("question", ""))
            if query:
                queries.append(query)

        if not queries:
            raise ValueError(
                f"No valid queries found in groundtruth file: {groundtruth_file}"
            )

        return queries

    def _get_default_queries(self) -> List[str]:
        """Return default questions for QA experiments on raw transcripts."""
        return [
            "What were the main topics discussed in this meeting?",
            "What action items were assigned and to whom?",
            "What decisions were made during this meeting?",
            "Who participated in this meeting and what were their roles?",
            "What are the next steps or follow-up items?",
        ]

    def _load_from_groundtruth_file(
        self, groundtruth_file: str, experiment_type: str
    ) -> List[Dict]:
        """Load data from a groundtruth JSON file."""
        with open(groundtruth_file, "r", encoding="utf-8") as f:
            groundtruth_data = json.load(f)

        analysis = groundtruth_data.get("analysis", {})

        if experiment_type == "qa":
            # Extract QA pairs from groundtruth
            qa_pairs = analysis.get("qa_pairs", [])

            if not qa_pairs:
                raise ValueError(
                    "No QA pairs found in groundtruth file for QA experiment"
                )

            data = []
            for qa_pair in qa_pairs:
                data.append(
                    {
                        "type": "qa",
                        "query": qa_pair.get("query", qa_pair.get("question", "")),
                        "ground_truth": qa_pair.get(
                            "response", qa_pair.get("answer", "")
                        ),
                    }
                )

            return data

        elif experiment_type == "summarization":
            # Extract transcript content and summaries from groundtruth
            summaries = analysis.get("summaries", {})

            if not summaries:
                raise ValueError(
                    "No summaries found in groundtruth file for summarization experiment"
                )

            # Get the source transcript content
            metadata = groundtruth_data.get("metadata", {})
            source_file = metadata.get("source_file", "")

            # Read transcript content
            if not source_file or not Path(source_file).exists():
                raise ValueError(f"Source transcript file not found: {source_file}")

            with open(source_file, "r", encoding="utf-8") as f:
                transcript_content = f.read().strip()

            if not transcript_content:
                raise ValueError(f"Empty transcript file: {source_file}")

            data = [
                {
                    "type": "summarization",
                    "transcript": transcript_content,
                    "groundtruth_summaries": summaries,
                    "source_file": source_file,
                }
            ]

            return data

        else:
            raise ValueError(f"Unsupported experiment type: {experiment_type}")

    def _load_from_transcript_file(
        self, transcript_file: str, experiment_type: str, queries_source: str = None
    ) -> List[Dict]:
        """Load data from a single transcript file."""
        with open(transcript_file, "r", encoding="utf-8") as f:
            transcript_content = f.read().strip()

        if not transcript_content:
            raise ValueError(f"Empty transcript file: {transcript_file}")

        if experiment_type == "qa":
            # Get queries from groundtruth source
            if not queries_source:
                queries = self._get_default_queries()
            else:
                queries = self._load_queries_from_groundtruth(queries_source)
                self.log.info(
                    f"Loaded {len(queries)} queries from groundtruth source: {queries_source}"
                )

            # For QA experiments on raw transcripts, we can't provide ground truth
            # The experiment will generate responses that can be manually evaluated
            return [
                {
                    "type": "qa_raw",
                    "transcript": transcript_content,
                    "source_file": transcript_file,
                    "queries": queries,
                }
            ]

        elif experiment_type == "summarization":
            return [
                {
                    "type": "summarization",
                    "transcript": transcript_content,
                    "source_file": transcript_file,
                }
            ]

        else:
            raise ValueError(f"Unsupported experiment type: {experiment_type}")

    def _load_from_transcript_directory(
        self, transcript_dir: str, experiment_type: str, queries_source: str = None
    ) -> List[Dict]:
        """Load data from a directory of transcript files."""
        transcript_dir = Path(transcript_dir)

        # Find all text files in directory
        transcript_files = list(transcript_dir.glob("*.txt"))
        if not transcript_files:
            raise ValueError(f"No .txt files found in directory: {transcript_dir}")

        data = []
        for transcript_file in transcript_files:
            file_data = self._load_from_transcript_file(
                str(transcript_file), experiment_type, queries_source
            )
            data.extend(file_data)

        return data

    def run_experiment(
        self,
        experiment: ExperimentConfig,
        data_items: List[Dict],
        output_dir: str,
        delay_seconds: float = 1.0,
    ) -> str:
        """Run a single experiment with the given data items."""
        self.log.info(
            f"Running experiment: {experiment.name} (type: {experiment.experiment_type})"
        )

        # Create LLM client
        client = self.create_llm_client(experiment)

        # Process each data item
        results = []
        total_usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
        total_cost = {"input_cost": 0.0, "output_cost": 0.0, "total_cost": 0.0}
        errors = []

        for i, data_item in enumerate(data_items):
            data_type = data_item["type"]
            self.log.info(
                f"Processing item {i+1}/{len(data_items)} (type: {data_type})"
            )

            # Process based on experiment and data type
            if data_type == "qa":
                # Process Q&A pair with ground truth
                if experiment.llm_type.lower() == "claude":
                    result = self.process_question_claude(
                        client, data_item["query"], experiment.system_prompt
                    )
                elif experiment.llm_type.lower() == "lemonade":
                    result = self.process_question_lemonade(
                        client,
                        data_item["query"],
                        experiment.system_prompt,
                        experiment.max_tokens,
                        experiment.temperature,
                    )

                # Create QA result entry
                result_entry = {
                    "query": data_item["query"],
                    "ground_truth": data_item["ground_truth"],
                    "response": result["response"],
                }

            elif data_type == "qa_raw":
                # Process raw transcript with predefined questions
                qa_results = []
                total_result = {
                    "response": "",
                    "usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
                    "cost": {"input_cost": 0.0, "output_cost": 0.0, "total_cost": 0.0},
                    "error": None,
                }

                for query in data_item["queries"]:
                    # Create context-aware prompt with transcript
                    context_prompt = f"{experiment.system_prompt}\n\nTranscript:\n{data_item['transcript']}\n\nQuestion: {query}\n\nAnswer:"

                    if experiment.llm_type.lower() == "claude":
                        # For Claude, we can use the context as system prompt
                        query_result = {
                            "response": "",
                            "usage": {
                                "input_tokens": 0,
                                "output_tokens": 0,
                                "total_tokens": 0,
                            },
                            "cost": {
                                "input_cost": 0.0,
                                "output_cost": 0.0,
                                "total_cost": 0.0,
                            },
                            "error": None,
                        }
                        try:
                            response_data = client.get_completion_with_usage(
                                context_prompt
                            )
                            response = response_data["content"]
                            if isinstance(response, list):
                                response_text = (
                                    response[0].text
                                    if hasattr(response[0], "text")
                                    else str(response[0])
                                )
                            else:
                                response_text = (
                                    response.text
                                    if hasattr(response, "text")
                                    else str(response)
                                )

                            query_result = {
                                "response": response_text.strip(),
                                "usage": response_data["usage"],
                                "cost": response_data["cost"],
                                "error": None,
                            }
                        except Exception as e:
                            self.log.error(f"Error processing QA with Claude: {e}")
                            query_result["response"] = f"ERROR: {str(e)}"
                            query_result["error"] = str(e)

                    elif experiment.llm_type.lower() == "lemonade":
                        # For Lemonade, use the full context prompt directly
                        query_result = {
                            "response": "",
                            "usage": {
                                "input_tokens": 0,
                                "output_tokens": 0,
                                "total_tokens": 0,
                            },
                            "cost": {
                                "input_cost": 0.0,
                                "output_cost": 0.0,
                                "total_cost": 0.0,
                            },
                            "error": None,
                        }
                        try:
                            response_data = client.completions(
                                model=client.model,  # Use model from experiment config
                                prompt=context_prompt,
                                max_tokens=experiment.max_tokens,
                                temperature=experiment.temperature,
                                stream=False,
                            )

                            # Extract text from the response
                            response_text = ""
                            if "choices" in response_data and response_data["choices"]:
                                response_text = response_data["choices"][0].get(
                                    "text", ""
                                )

                            query_result["response"] = response_text.strip()
                        except Exception as e:
                            self.log.error(f"Error processing QA with Lemonade: {e}")
                            query_result["response"] = f"ERROR: {str(e)}"
                            query_result["error"] = str(e)

                    qa_results.append(
                        {"query": query, "response": query_result["response"]}
                    )

                    # Accumulate usage/cost
                    if query_result["usage"]:
                        for key in total_result["usage"]:
                            total_result["usage"][key] += query_result["usage"].get(
                                key, 0
                            )
                    if query_result["cost"]:
                        for key in total_result["cost"]:
                            total_result["cost"][key] += query_result["cost"].get(
                                key, 0.0
                            )
                    if query_result["error"]:
                        if total_result["error"]:
                            total_result["error"] += f"; {query_result['error']}"
                        else:
                            total_result["error"] = query_result["error"]

                result = total_result
                result_entry = {
                    "transcript": (
                        data_item["transcript"][:500] + "..."
                        if len(data_item["transcript"]) > 500
                        else data_item["transcript"]
                    ),
                    "source_file": data_item.get("source_file", ""),
                    "qa_results": qa_results,
                }

            elif data_type == "summarization":
                # Process summarization task using independent calls for each component
                if experiment.llm_type.lower() == "claude":
                    result = self.process_summarization_claude(
                        client, data_item["transcript"], experiment.system_prompt
                    )
                elif experiment.llm_type.lower() == "lemonade":
                    result = self.process_summarization_lemonade(
                        client,
                        data_item["transcript"],
                        experiment.system_prompt,
                        experiment.max_tokens,
                        experiment.temperature,
                    )

                # Use the structured response directly from independent calls
                generated_summaries = result["response"]

                # Create summarization result entry
                result_entry = {
                    "transcript": (
                        data_item["transcript"][:500] + "..."
                        if len(data_item["transcript"]) > 500
                        else data_item["transcript"]
                    ),
                    "generated_summaries": generated_summaries,
                    "source_file": data_item.get("source_file", ""),
                }

                # Add ground truth summaries if available (from groundtruth files)
                if "groundtruth_summaries" in data_item:
                    result_entry["groundtruth_summaries"] = data_item[
                        "groundtruth_summaries"
                    ]

            else:
                self.log.error(f"Unsupported data type: {data_type}")
                continue

            # Accumulate usage and cost data
            if result["usage"]:
                for key in total_usage:
                    total_usage[key] += result["usage"].get(key, 0)
            if result["cost"]:
                for key in total_cost:
                    total_cost[key] += result["cost"].get(key, 0.0)

            if result["error"]:
                errors.append(f"Item {i+1}: {result['error']}")

            results.append(result_entry)

            # Add delay between requests to avoid rate limiting
            if delay_seconds > 0 and i < len(data_items) - 1:
                time.sleep(delay_seconds)

        # Create output data in format expected by eval tool
        output_data = {
            "metadata": {
                "experiment_name": experiment.name,
                "experiment_type": experiment.experiment_type,
                "llm_type": experiment.llm_type,
                "model": experiment.model,
                "system_prompt": experiment.system_prompt,
                "max_tokens": experiment.max_tokens,
                "temperature": experiment.temperature,
                "parameters": experiment.parameters,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "similarity_threshold": 0.7,  # Default threshold for eval
                "total_items": len(data_items),
                "total_usage": total_usage,
                "total_cost": total_cost,
                "errors": errors,
            },
            "analysis": {},
        }

        # Set analysis data based on experiment type and data type
        if experiment.experiment_type == "qa":
            # Check if we have traditional QA results or raw transcript QA results
            if results and "qa_results" in results[0]:
                output_data["analysis"]["transcript_qa_results"] = results
            else:
                output_data["analysis"]["qa_results"] = results
        elif experiment.experiment_type == "summarization":
            output_data["analysis"]["summarization_results"] = results

        # Save results to file
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Generate safe filename from experiment name
        safe_name = "".join(
            c for c in experiment.name if c.isalnum() or c in (" ", "-", "_")
        ).rstrip()
        safe_name = safe_name.replace(" ", "_")
        result_filename = f"{safe_name}.experiment.json"
        result_path = output_path / result_filename

        with open(result_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2)

        self.log.info(f"Experiment results saved to: {result_path}")
        return str(result_path)

    def run_all_experiments(
        self,
        input_path: str,
        output_dir: str,
        delay_seconds: float = 1.0,
        queries_source: str = None,
    ) -> List[str]:
        """Run all experiments defined in the config file."""
        self.log.info(
            f"Starting batch experiments with {len(self.experiments)} configurations"
        )

        # Run each experiment
        result_files = []
        for i, experiment in enumerate(self.experiments):
            self.log.info(
                f"Running experiment {i+1}/{len(self.experiments)}: {experiment.name} (type: {experiment.experiment_type})"
            )

            # Load data from input source based on experiment type
            data_items = self.load_data_from_source(
                input_path, experiment.experiment_type, queries_source
            )
            self.log.info(
                f"Loaded {len(data_items)} data items from {input_path} for {experiment.experiment_type} experiment"
            )

            result_file = self.run_experiment(
                experiment, data_items, output_dir, delay_seconds
            )
            result_files.append(result_file)

            # Add delay between experiments
            if delay_seconds > 0 and i < len(self.experiments) - 1:
                self.log.info(f"Waiting {delay_seconds}s before next experiment...")
                time.sleep(delay_seconds)

        self.log.info(
            f"Completed {len(result_files)} out of {len(self.experiments)} experiments"
        )
        return result_files

    def create_sample_config(self, output_path: str):
        """Create a sample configuration file."""
        sample_config = {
            "description": "Batch experiment configuration for transcript evaluation (both Q&A and summarization)",
            "experiments": [
                {
                    "name": "Claude-Sonnet-QA-Standard",
                    "llm_type": "claude",
                    "model": "claude-sonnet-4-20250514",
                    "experiment_type": "qa",
                    "system_prompt": "You are a helpful assistant that answers questions about meeting transcripts. Provide accurate, concise answers based on the transcript content.",
                    "max_tokens": 512,
                    "temperature": 0.1,
                    "parameters": {},
                },
                {
                    "name": "Claude-Sonnet-Summarization-Standard",
                    "llm_type": "claude",
                    "model": "claude-sonnet-4-20250514",
                    "experiment_type": "summarization",
                    "system_prompt": "You are an expert meeting analyst. Analyze the transcript carefully and provide clear, accurate information based on the content.",
                    "max_tokens": 512,
                    "temperature": 0.1,
                    "parameters": {},
                },
                {
                    "name": "Claude-Sonnet-QA-Detailed",
                    "llm_type": "claude",
                    "model": "claude-sonnet-4-20250514",
                    "experiment_type": "qa",
                    "system_prompt": "You are an expert meeting analyst. Provide comprehensive, detailed answers about meeting transcripts including context, participants, and implications. Be thorough and precise.",
                    "max_tokens": 1024,
                    "temperature": 0.2,
                    "parameters": {},
                },
                {
                    "name": "Lemonade-Llama-QA-Standard",
                    "llm_type": "lemonade",
                    "model": "llama3.2:3b",
                    "experiment_type": "qa",
                    "system_prompt": "Answer questions about meeting transcripts clearly and accurately. Focus on the key information requested.",
                    "max_tokens": 512,
                    "temperature": 0.1,
                    "parameters": {"host": "127.0.0.1", "port": 8000},
                },
                {
                    "name": "Lemonade-Llama-Summarization-Creative",
                    "llm_type": "lemonade",
                    "model": "llama3.2:3b",
                    "experiment_type": "summarization",
                    "system_prompt": "You are a creative meeting analyst. Analyze the transcript thoughtfully and provide insightful information that captures key insights and implications.",
                    "max_tokens": 512,
                    "temperature": 0.7,
                    "parameters": {"host": "127.0.0.1", "port": 8000},
                },
            ],
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(sample_config, f, indent=2)

        self.log.info(f"Sample configuration saved to: {output_path}")

    def create_config_from_groundtruth(
        self, groundtruth_file: str, output_file: str
    ) -> None:
        """Create experiment configuration from groundtruth file metadata."""
        try:
            # Load groundtruth file
            with open(groundtruth_file, "r", encoding="utf-8") as f:
                groundtruth_data = json.load(f)

            metadata = groundtruth_data.get("metadata", {})
            analysis = groundtruth_data.get("analysis", {})

            # Extract key information
            use_case = metadata.get("use_case", "qa")
            original_model = metadata.get("claude_model", "claude-sonnet-4-20250514")
            original_prompt = metadata.get("system_prompt", "")
            max_tokens = metadata.get("max_tokens", 512 if use_case == "qa" else 1024)
            temperature = metadata.get("temperature", 0.1)

            # Determine appropriate system prompt if not in metadata
            if not original_prompt:
                if use_case == "qa":
                    original_prompt = "You are an expert meeting analyst. Answer questions about the transcript accurately and concisely based only on the provided information."
                elif use_case == "summarization":
                    original_prompt = "You are an expert meeting analyst. Create a concise summary of the transcript including key topics, decisions, and action items."
                else:
                    original_prompt = "You are an expert analyst. Process the provided content according to the task requirements."

            # Create base experiment configuration
            experiments = []

            # Original configuration
            base_name = original_model.replace("claude-", "").replace("-", "-").title()
            experiments.append(
                {
                    "name": f"{base_name}-Original",
                    "llm_type": "claude",
                    "model": original_model,
                    "experiment_type": use_case,
                    "system_prompt": original_prompt,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "parameters": {},
                }
            )

            # Add model variations with same prompt
            model_variants = [
                ("claude-3-haiku-20240307", "Haiku"),
                ("claude-3-opus-20240229", "Opus"),
                ("claude-sonnet-4-20250514", "Sonnet-4"),
            ]

            for model, name in model_variants:
                if model != original_model:  # Don't duplicate original
                    experiments.append(
                        {
                            "name": f"Claude-{name}-Same-Prompt",
                            "llm_type": "claude",
                            "model": model,
                            "experiment_type": use_case,
                            "system_prompt": original_prompt,
                            "max_tokens": max_tokens,
                            "temperature": temperature,
                            "parameters": {},
                        }
                    )

            # Add temperature variations for original model
            if temperature != 0.0:
                experiments.append(
                    {
                        "name": f"{base_name}-Creative",
                        "llm_type": "claude",
                        "model": original_model,
                        "experiment_type": use_case,
                        "system_prompt": original_prompt,
                        "max_tokens": max_tokens,
                        "temperature": min(0.7, temperature + 0.3),
                        "parameters": {},
                    }
                )

            if temperature != 0.0:
                experiments.append(
                    {
                        "name": f"{base_name}-Deterministic",
                        "llm_type": "claude",
                        "model": original_model,
                        "experiment_type": use_case,
                        "system_prompt": original_prompt,
                        "max_tokens": max_tokens,
                        "temperature": 0.0,
                        "parameters": {},
                    }
                )

            # Create configuration structure
            groundtruth_name = Path(groundtruth_file).stem
            config = {
                "description": f"Configuration generated from groundtruth metadata: {groundtruth_name}",
                "source_groundtruth": groundtruth_file,
                "generated_at": datetime.now().isoformat(),
                "original_metadata": metadata,
                "experiments": experiments,
            }

            # Save configuration
            output_path = Path(output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)

            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2, ensure_ascii=False)

            self.log.info(
                f"Generated experiment configuration with {len(experiments)} experiments"
            )
            self.log.info(f"Configuration saved to: {output_path}")

            return str(output_path)

        except Exception as e:
            self.log.error(f"Error creating config from groundtruth: {e}")
            raise


def main():
    """Command line interface for batch experiments."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Run batch experiments with different LLM configurations",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Create sample configuration file
  python -m gaia.eval.batch_experiment --create-sample-config experiment_config.json

  # Run batch experiments on transcript directory
  python -m gaia.eval.batch_experiment -c experiment_config.json -i ./transcripts -o ./output/experiments

  # Run batch experiments on transcript directory with custom queries from groundtruth
  python -m gaia.eval.batch_experiment -c experiment_config.json -i ./transcripts -q ./output/groundtruth/meeting.qa.groundtruth.json -o ./output/experiments

  # Run batch experiments on groundtruth file
  python -m gaia.eval.batch_experiment -c experiment_config.json -i ./output/groundtruth/transcript.qa.groundtruth.json -o ./output/experiments

  # Run with custom delay between requests
  python -m gaia.eval.batch_experiment -c experiment_config.json -i ./transcripts -o ./output/experiments --delay 2.0
        """,
    )

    parser.add_argument(
        "-c", "--config", type=str, help="Path to experiment configuration JSON file"
    )
    parser.add_argument(
        "-i",
        "--input",
        type=str,
        help="Path to input data: transcript file, directory of transcripts, or groundtruth JSON file",
    )
    parser.add_argument(
        "-q",
        "--queries-source",
        type=str,
        help="Path to groundtruth JSON file to extract queries from (for QA experiments on raw transcripts)",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        type=str,
        default="./output/experiments",
        help="Output directory for experiment results (default: ./output/experiments)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Delay in seconds between requests to avoid rate limiting (default: 1.0)",
    )
    parser.add_argument(
        "--create-sample-config",
        type=str,
        help="Create a sample configuration file at the specified path",
    )
    parser.add_argument(
        "--create-config-from-groundtruth",
        type=str,
        help="Create configuration from groundtruth file metadata (provide groundtruth file path)",
    )

    args = parser.parse_args()

    # Create sample config if requested
    if args.create_sample_config:
        runner = BatchExperimentRunner.__new__(BatchExperimentRunner)
        runner.log = get_logger(__name__)
        runner.create_sample_config(args.create_sample_config)
        print(f"✅ Sample configuration created: {args.create_sample_config}")
        print("Edit this file to define your experiments, then run:")
        print(
            f"  python -m gaia.eval.batch_experiment -c {args.create_sample_config} -i <input_path> -o <output_dir>"
        )
        return

    # Create config from groundtruth if requested
    if args.create_config_from_groundtruth:
        # Determine output filename if not provided in the argument
        groundtruth_path = Path(args.create_config_from_groundtruth)
        default_output = f"{groundtruth_path.stem}.config.json"

        runner = BatchExperimentRunner.__new__(BatchExperimentRunner)
        runner.log = get_logger(__name__)
        config_path = runner.create_config_from_groundtruth(
            args.create_config_from_groundtruth, default_output
        )
        print(f"✅ Configuration created from groundtruth metadata: {config_path}")
        print("Review and edit the configuration, then run:")
        print(
            f"  python -m gaia.eval.batch_experiment -c {config_path} -i <input_path> -o <output_dir>"
        )
        return

    # Validate required arguments
    if not args.config or not args.input:
        parser.error(
            "Both --config and --input are required (unless using --create-sample-config or --create-config-from-groundtruth)"
        )

    # Run batch experiments
    runner = BatchExperimentRunner(args.config)
    result_files = runner.run_all_experiments(
        input_path=args.input,
        output_dir=args.output_dir,
        delay_seconds=args.delay,
        queries_source=args.queries_source,
    )

    print(f"✅ Completed {len(result_files)} experiments")
    print(f"  Results saved to: {args.output_dir}")
    print(f"  Generated files:")
    for result_file in result_files:
        print(f"    - {Path(result_file).name}")

    print(f"\nNext steps:")
    print(f"  1. Evaluate results using: gaia eval -f <result_file>")
    print(f"  2. Generate comparative report: gaia report -d {args.output_dir}")


if __name__ == "__main__":
    exit(main())
