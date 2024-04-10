import os
import random
from PIL import Image

# Define directories
base_dir = '/mnt/data/Pwnkey/Pwnkey'
layers = ['background', 'eyes', 'body', 'mouth', 'hair', 'ears', 'hat', 'details']
output_dir = '/mnt/data/output'
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Function to load and overlay images
def overlay_images(base_image, overlay_image):
    base_image.paste(overlay_image, (0, 0), overlay_image)
    return base_image

# Function to create NFT
def create_nft():
    # Initialize the base image with the first layer (background)
    background_path = os.path.join(base_dir, layers[0], random.choice(os.listdir(os.path.join(base_dir, layers[0]))))
    base_image = Image.open(background_path).convert("RGBA")

    # Overlay each layer
    for layer in layers[1:]:
        overlay_path = os.path.join(base_dir, layer, random.choice(os.listdir(os.path.join(base_dir, layer))))
        overlay_image = Image.open(overlay_path).convert("RGBA")
        base_image = overlay_images(base_image, overlay_image)
    
    # Save the final image
    final_image_path = os.path.join(output_dir, 'final_nft.png')
    base_image.save(final_image_path)
    print(f"Final NFT created at: {final_image_path}")

    # Metadata creation could be added here

create_nft()