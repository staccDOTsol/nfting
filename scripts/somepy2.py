import os
import re
import glob

def rename_files_sequentially(dir_path, file_pattern, output_pattern):
    """Rename files to have sequential numbering with no prefix"""
    # Get list of files matching the pattern
    files = glob.glob(os.path.join(dir_path, file_pattern))
    
    # Extract numbers from filenames using regex
    number_pattern = re.compile(r'(\d+)')
    file_numbers = []
    
    for file in files:
        filename = os.path.basename(file)
        match = number_pattern.search(filename)
        if match:
            number = int(match.group(1))
            file_numbers.append((file, number))
    
    # Sort by the extracted number
    file_numbers.sort(key=lambda x: x[1])
    
    # Rename files sequentially
    for new_index, (old_path, _) in enumerate(file_numbers):
        filename = os.path.basename(old_path)
        new_filename = output_pattern.format(new_index)
        new_path = os.path.join(dir_path, new_filename)
        
        print(f"Renaming: {filename} -> {new_filename}")
        os.rename(old_path, new_path)

def main():
    # Base directory where both metadata and images are stored
    base_dir = "."  # Change this if needed
    
    # Rename metadata files - strip the 'metadata_' prefix
    metadata_dir = os.path.join(base_dir, "metadata")
    print("Renaming metadata files...")
    rename_files_sequentially(metadata_dir, "metadata_*.json", "{}.json")
    
    # Rename image files - strip the 'image_' prefix
    images_dir = os.path.join(base_dir, "images")
    print("Renaming image files...")
    rename_files_sequentially(images_dir, "image_*.png", "{}.png")

if __name__ == "__main__":
    main()