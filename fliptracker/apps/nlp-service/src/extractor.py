class HybridExtractor:
    def __init__(self):
        # 1. On définit le chemin absolu pour Docker
        docker_model_path = "/app/trained_models/model-best"
        
        # 2. On définit un chemin relatif pour ton développement local
        local_model_path = os.path.join(os.getcwd(), "model-best")

        if os.path.exists(docker_model_path):
            print(f"✅ Loading Docker model from {docker_model_path}")
            self.nlp = spacy.load(docker_model_path)
        elif os.path.exists(local_model_path):
            print(f"✅ Loading local model from {local_model_path}")
            self.nlp = spacy.load(local_model_path)
        else:
            print("⚠️ No custom model found. Using blank 'fr' model.")
            self.nlp = spacy.blank("fr")