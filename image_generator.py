import base64
import json
import os
import random
import time
import requests
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from tqdm import tqdm
from dotenv import load_dotenv

# Load API key from environment (or set it directly here, but using env vars is safer)
load_dotenv()
api_key = os.getenv("TOGETHER_API_KEY") or "tgp_v1_5VFoyJO0JioeDr0sGls1kg61v1BrP8H_vStE9WysDZ8"

# Create output directories
os.makedirs("images", exist_ok=True)
os.makedirs("metadata", exist_ok=True)

# Constants
TOTAL_IMAGES = 10000
MODEL = "black-forest-labs/FLUX.1-dev"
NUM_THREADS = 100
IMAGES_PER_REQUEST = 100  # Generate 100 images per API call
BASE_URL = "https://api.together.xyz/v1/images/generations"

# Lock for thread-safe operations
progress_lock = Lock()
success_count = 0
failed_indices = []

# Character traits for prompt generation
characters = [
    "wizard", "warrior", "elf", "dwarf", "fairy", "dragon", "knight", "princess", 
    "prince", "queen", "king", "assassin", "witch", "sorcerer", "paladin", "ranger",
    "samurai", "ninja", "vampire", "werewolf", "mermaid", "centaur", "minotaur", "griffin",
    "phoenix", "demon", "angel", "djinn", "ghost", "necromancer", "pirate", "viking"
]

# ... [other traits data remains the same]
crown_types = [
    "golden", "silver", "crystal", "diamond", "emerald", "ruby", "sapphire", "obsidian",
    "platinum", "bronze", "copper", "iron", "wooden", "bone", "thorny", "floral",
    "celestial", "infernal", "ancient", "glowing", "ethereal", "shadowy", "ornate"
]

crown_styles = [
    "ornate", "simple", "elegant", "massive", "spiky", "delicate", "intricate", "minimalist",
    "baroque", "gothic", "renaissance", "futuristic", "steampunk", "cyberpunk", "medieval"
]

art_styles = [
    "digital art", "illustration", "watercolor", "oil painting", "ink drawing", "concept art",
    "fantasy art", "anime", "manga", "comic book", "pixel art", "3D render", "photorealistic"
]

backgrounds = [
    "throne room", "battlefield", "enchanted forest", "mountain peak", "desert", "ocean",
    "castle", "dungeon", "celestial realm", "hellscape", "void", "cosmic space", "meadow"
]

def generate_prompt():
    """Generate a random creative prompt for a character with a crown"""
    character = random.choice(characters)
    crown_type = random.choice(crown_types)
    crown_style = random.choice(crown_styles)
    art_style = random.choice(art_styles)
    background = random.choice(backgrounds)
    
    adjectives = ["majestic", "powerful", "mysterious", "elegant", "ancient", "fearsome", 
                 "serene", "noble", "cunning", "ethereal", "imposing", "graceful", "regal"]
    
    prompt = f"A {random.choice(adjectives)} {character} wearing an illustrious {crown_style} {crown_type} crown, "
    prompt += f"standing in a {background}, {art_style} style, highly detailed, perfect lighting"
    
    return prompt

def generate_metadata(image_id, prompt):
    """Generate Solana NFT metadata for an image"""
    return {
        "name": f"Crowned Character #{image_id}",
        "description": prompt,
        "image": f"image_{image_id}.png",
        "attributes": [
            {"trait_type": "Character Type", "value": next((c for c in characters if c in prompt.lower()), "Unknown")},
            {"trait_type": "Crown Type", "value": next((c for c in crown_types if c in prompt.lower()), "Unknown")},
            {"trait_type": "Art Style", "value": next((s for s in art_styles if s in prompt.lower()), "Unknown")},
            {"trait_type": "Background", "value": next((b for b in backgrounds if b in prompt.lower()), "Unknown")}
        ]
    }

def generate_batch_images(batch_start_index):
    """Generate a batch of images using a single API call"""
    global success_count
    
    # For consistent metadata, use the same prompt for all images in the batch
    prompt = generate_prompt()
    retry_count = 0
    max_retries = 3
    
    while retry_count < max_retries:
        try:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": MODEL,
                "prompt": prompt,
                "width": 1024,
                "height": 768,
                "steps": 28,
                "n": IMAGES_PER_REQUEST,  # Generate 100 images at once
                "response_format": "b64_json"
            }
            
            response = requests.post(BASE_URL, headers=headers, json=payload)
            response.raise_for_status()
            
            # Extract the base64 images
            result = response.json()
            
            # Process each of the 100 images in the response
            for i, image_data in enumerate(result["data"]):
                image_index = batch_start_index + i
                if image_index >= TOTAL_IMAGES:
                    break
                    
                # Save the image
                image_path = f"images/image_{image_index}.png"
                with open(image_path, "wb") as f:
                    f.write(base64.b64decode(image_data["b64_json"]))
                
                # Create and save metadata
                metadata = generate_metadata(image_index, prompt)
                metadata_path = f"metadata/metadata_{image_index}.json"
                with open(metadata_path, "w") as f:
                    json.dump(metadata, f, indent=2)
            
            # Update progress (thread-safe)
            with progress_lock:
                # Calculate actual number of images processed in this batch
                batch_size = min(IMAGES_PER_REQUEST, TOTAL_IMAGES - batch_start_index)
                success_count += batch_size
            
            return True
            
        except Exception as e:
            retry_count += 1
            if retry_count >= max_retries:
                # Mark all indices in this batch as failed
                with progress_lock:
                    batch_size = min(IMAGES_PER_REQUEST, TOTAL_IMAGES - batch_start_index)
                    for i in range(batch_size):
                        failed_indices.append(batch_start_index + i)
                print(f"Failed to generate batch starting at {batch_start_index} after {max_retries} attempts: {str(e)}")
                return False
            
            # Exponential backoff
            sleep_time = 2 ** retry_count
            time.sleep(sleep_time)

def main():
    print(f"Generating {TOTAL_IMAGES} images using {NUM_THREADS} threads with {IMAGES_PER_REQUEST} images per request...")
    
    start_time = time.time()
    
    # Create progress bar
    progress_bar = tqdm(total=TOTAL_IMAGES, desc="Generating Images")
    
    # Function to update progress bar
    def update_progress():
        while success_count < TOTAL_IMAGES and len(failed_indices) + success_count < TOTAL_IMAGES:
            current = success_count
            progress_bar.n = current
            progress_bar.refresh()
            time.sleep(0.5)
    
    # Start progress tracking in a separate thread
    import threading
    progress_thread = threading.Thread(target=update_progress)
    progress_thread.daemon = True
    progress_thread.start()
    
    # Calculate batch starting indices
    batch_indices = list(range(0, TOTAL_IMAGES, IMAGES_PER_REQUEST))
    
    # Execute work in thread pool
    with ThreadPoolExecutor(max_workers=NUM_THREADS) as executor:
        # Submit batch tasks
        futures = [executor.submit(generate_batch_images, i) for i in batch_indices]
        
        # Wait for all tasks to complete
        for future in futures:
            future.result()
    
    # Final progress update
    progress_bar.n = success_count
    progress_bar.refresh()
    progress_bar.close()
    
    # Print summary
    end_time = time.time()
    elapsed_time = end_time - start_time
    
    print(f"\nGeneration completed in {elapsed_time:.2f} seconds")
    print(f"Successfully generated: {success_count} images")
    
    if failed_indices:
        print(f"Failed to generate {len(failed_indices)} images at indices: {failed_indices[:10]}...")
        
        # Write failed indices to file for later retry
        with open("failed_indices.json", "w") as f:
            json.dump(failed_indices, f)
            
        print("Failed indices saved to failed_indices.json")

if __name__ == "__main__":
    main() 