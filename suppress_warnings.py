# suppress_warnings.py
import warnings
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # TensorFlow logs
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'  # oneDNN warnings

# Suppress all warnings at startup
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=UserWarning)
