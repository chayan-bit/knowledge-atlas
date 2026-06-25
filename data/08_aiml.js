atlasAdd({
  id: "aiml",
  num: 8,
  title: "AI / Machine Learning",
  icon: "🧠",
  color: "#2ac3de",
  tagline: "From linear algebra to training LLMs, RL agents, and production ML systems.",
  overview: [
    "ML is applied math made executable: linear algebra + calculus + probability, optimized by gradient descent, scaled by systems engineering. The discipline that separates practitioners from users is implementing the core objects from scratch — backprop, attention, PPO — until there is no magic left.",
    "The arc: math + classical ML → neural nets from first principles → the modern stack (transformers, LLMs, diffusion, RL) → training/serving systems → interpretability and alignment research. The systems half of modern ML lives next door in GPU Systems; the math half is shared with quant and graphics.",
  ],
  topics: [
    {
      id: "ai-math",
      title: "Mathematical foundations",
      level: "Beginner",
      body: [
        "**Linear algebra** (matrix multiply, rank, **eigendecomposition** → PCA), **calculus** (the chain rule *is* backpropagation, Jacobians/Hessians), and **probability** (distributions, expectation/variance, Bayes, and **information theory**: entropy, KL divergence, cross-entropy derived from MLE).",
        "Don't skip the derivations — cross-entropy-from-MLE and PCA-from-covariance are the kind of understanding everything else is built on.",
      ],
      resources: [
        { label: "3Blue1Brown — Essence of Linear Algebra", url: "https://www.3blue1brown.com/topics/linear-algebra", type: "video" },
        { label: "Mathematics for Machine Learning (free PDF)", url: "https://mml-book.github.io/", type: "book" },
        { label: "3B1B — Essence of Calculus / Neural Nets", url: "https://www.3blue1brown.com/topics/neural-networks", type: "video" },
      ],
      connections: [
        { to: "game-math", note: "Same linear algebra (dot products, projections) you used for game transforms" },
        { to: "quant-stats", note: "Probability, distributions and covariance are shared with quant finance" },
        { to: "crypto-numbertheory", note: "Different math (number theory) but the same 'derive it, don't memorize' rigor" },
      ],
    },
    {
      id: "ai-classical",
      title: "Classical ML",
      level: "Beginner → Intermediate",
      body: [
        "Linear/logistic regression (closed form *and* gradient descent), decision trees (information gain/Gini), random forests (bagging), **gradient boosting** (XGBoost/LightGBM), SVMs (max-margin, the kernel trick), k-means, and the **bias-variance tradeoff** + regularization.",
        "Gradient-boosted trees remain the best tool for tabular data — including most of quant finance — so this is not just a stepping stone.",
      ],
      resources: [
        { label: "Hands-On Machine Learning — Géron (code, free)", url: "https://github.com/ageron/handson-ml3", type: "repo" },
        { label: "scikit-learn — user guide", url: "https://scikit-learn.org/stable/user_guide.html", type: "docs" },
        { label: "StatQuest — ML fundamentals", url: "https://www.youtube.com/@statquest", type: "video" },
      ],
      connections: [
        { to: "quant-ml", note: "LightGBM on engineered features is the workhorse of ML-driven trading" },
        { to: "dsa-trees", note: "Decision trees are the trees from DSA with an information-gain split rule" },
      ],
    },
    {
      id: "ai-nn",
      title: "Neural nets from first principles + PyTorch",
      level: "Intermediate",
      body: [
        "MLPs as matrix multiplies, **backpropagation** as reverse-mode autodiff (derive it!), activations (why GELU in transformers), optimizers (SGD→Adam→AdamW, derive the update), initialization (Xavier/He), regularization (dropout, batch/layer norm), and LR schedules. Then **PyTorch** internals: tensor strides/views, autograd, custom `nn.Module`, training loops without `Trainer`, mixed precision (`amp`), and DDP.",
        "Karpathy's *Zero to Hero* — building micrograd then nanoGPT — is the single best path through this.",
      ],
      resources: [
        { label: "Karpathy — Neural Networks: Zero to Hero", url: "https://karpathy.ai/zero-to-hero.html", type: "video", note: "the best intro to NNs, full stop" },
        { label: "PyTorch — official tutorials", url: "https://pytorch.org/tutorials/", type: "docs" },
        { label: "Dive into Deep Learning (d2l.ai, free)", url: "https://d2l.ai/", type: "book", note: "math + code side by side" },
      ],
      connections: [
        { to: "gpu-model", note: "Every matmul/backward pass runs as GPU kernels — the systems half" },
        { to: "ai-math", note: "Backprop is literally the chain rule from the math foundations" },
        { to: "ai-training", note: "Mixed precision and DDP scale this to many GPUs" },
      ],
    },
    {
      id: "ai-cv",
      title: "Computer vision",
      level: "Intermediate",
      body: [
        "**CNNs** (convolution, receptive fields, pooling), architectures (VGG→**ResNet** residual connections→ConvNeXt), object detection (YOLO, Faster R-CNN, **DETR**), segmentation (U-Net, **SAM**), data augmentation, and transfer learning.",
        "Train a ResNet on CIFAR-10 to >93% from scratch — it makes the whole stack concrete.",
      ],
      resources: [
        { label: "Stanford CS231n — CNNs for Visual Recognition", url: "https://cs231n.github.io/", type: "course" },
        { label: "ResNet — Deep Residual Learning (paper)", url: "https://arxiv.org/abs/1512.03385", type: "paper" },
      ],
      connections: [
        { to: "ai-diffusion", note: "U-Net is the backbone of Stable Diffusion's denoiser" },
        { to: "game-raytracing", note: "Neural denoising/upscaling (DLSS) is CV applied to rendering" },
      ],
    },
    {
      id: "ai-sequence",
      title: "Sequence models & transformers",
      level: "Intermediate → Advanced",
      body: [
        "RNN/LSTM/GRU and the vanishing-gradient problem, seq2seq with **Bahdanau attention** (the precursor), then the **transformer**: scaled dot-product **self-attention** (derive it), multi-head attention, positional encodings (sinusoidal → **RoPE** → ALiBi), pre- vs post-norm blocks, and BERT vs GPT (masked vs causal).",
        "Attention is the central object of modern AI — implement it from scratch until it's trivial.",
      ],
      resources: [
        { label: "The Illustrated Transformer — Jay Alammar", url: "https://jalammar.github.io/illustrated-transformer/", type: "docs" },
        { label: "Attention Is All You Need (paper)", url: "https://arxiv.org/abs/1706.03762", type: "paper" },
        { label: "The Annotated Transformer (Harvard)", url: "https://nlp.seas.harvard.edu/annotated-transformer/", type: "docs" },
      ],
      connections: [
        { to: "gpu-fusion", note: "FlashAttention is the IO-aware GPU kernel that makes attention fast" },
        { to: "ai-llm", note: "Transformers are the architecture LLMs scale up" },
        { to: "dsa-strings", note: "BPE tokenization is a greedy substring-merge string algorithm" },
      ],
    },
    {
      id: "ai-llm",
      title: "Large Language Models",
      level: "Advanced",
      body: [
        "**Scaling laws** (Chinchilla, compute-optimal tokens vs params), **tokenization** (BPE/SentencePiece), the **KV cache** (and its memory math), training instabilities, instruction tuning (SFT), **RLHF** (reward model + PPO + KL penalty) and its simpler cousin **DPO**, efficient fine-tuning (**LoRA/QLoRA** — the actual math), and **quantization** (INT8/INT4, GPTQ/AWQ).",
        "Build a small GPT, then fine-tune a real model with LoRA — the two reps that demystify the whole field.",
      ],
      resources: [
        { label: "Karpathy — Let's build GPT / nanoGPT", url: "https://github.com/karpathy/nanoGPT", type: "repo", note: "understand every line" },
        { label: "Hugging Face — LLM Course (free)", url: "https://huggingface.co/learn/llm-course", type: "course" },
        { label: "LoRA — Low-Rank Adaptation (paper)", url: "https://arxiv.org/abs/2106.09685", type: "paper" },
        { label: "Lilian Weng — blog (the best ML blog)", url: "https://lilianweng.github.io/", type: "docs" },
      ],
      connections: [
        { to: "gpu-inference", note: "vLLM/PagedAttention/quantization is how LLMs actually get served" },
        { to: "comp-runtime", note: "Inference engines (llama.cpp/vLLM) are JIT-like tensor runtimes" },
        { to: "ai-mlops", note: "Serving, evaluation and RAG are the applied/agentic end of LLMs" },
      ],
    },
    {
      id: "ai-diffusion",
      title: "Diffusion models",
      level: "Advanced",
      body: [
        "**DDPM** (forward noising, reverse denoising, loss derivation), the **score-matching** connection, **DDIM** (deterministic, 10-50× faster sampling), Stable Diffusion's architecture (VAE latent space + U-Net + CLIP), **classifier-free guidance**, ControlNet, and fine-tuning (DreamBooth, textual inversion, LoRA).",
        "The math (diffusion as SDEs) is genuinely beautiful and connects to stochastic calculus you'll meet in quant.",
      ],
      resources: [
        { label: "Lilian Weng — What are Diffusion Models?", url: "https://lilianweng.github.io/posts/2021-07-11-diffusion-models/", type: "docs" },
        { label: "DDPM — Denoising Diffusion Probabilistic Models (paper)", url: "https://arxiv.org/abs/2006.11239", type: "paper" },
      ],
      connections: [
        { to: "ai-cv", note: "The denoiser is a U-Net from computer vision" },
        { to: "quant-options", note: "Diffusion-as-SDE shares Itô calculus with derivatives pricing" },
        { to: "game-raytracing", note: "Diffusion-era denoisers feed real-time rendering pipelines" },
      ],
    },
    {
      id: "ai-rl",
      title: "Reinforcement learning",
      level: "Advanced",
      body: [
        "The **MDP** formalism, value functions and the **Bellman equations** (fixed-point iteration), DP (policy/value iteration), Monte Carlo and **TD learning**, **Q-learning**/DQN (replay buffer + target network), policy gradients (REINFORCE → actor-critic → **PPO**), and model-based RL / world models (DreamerV3).",
        "PPO is the bridge to RLHF; implementing it from scratch and solving a control benchmark is the milestone.",
      ],
      resources: [
        { label: "Sutton & Barto — Reinforcement Learning (free)", url: "http://incompleteideas.net/book/the-book-2nd.html", type: "book", note: "the RL bible" },
        { label: "Berkeley CS285 — Deep RL (free)", url: "https://rail.eecs.berkeley.edu/deeprlcourse/", type: "course" },
        { label: "Spinning Up in Deep RL — OpenAI", url: "https://spinningup.openai.com/", type: "docs" },
      ],
      connections: [
        { to: "dsa-paradigms", note: "Value/policy iteration are dynamic programming on the Bellman equation" },
        { to: "ai-llm", note: "RLHF/PPO is RL applied to align language models" },
        { to: "quant-microstructure", note: "RL for market making / optimal execution is an active quant frontier" },
      ],
    },
    {
      id: "ai-training",
      title: "Training systems & efficiency",
      level: "Advanced",
      body: [
        "**Gradient checkpointing** (recompute vs store), **tensor/pipeline parallelism**, the **ZeRO** optimizer (DeepSpeed sharding stages), **FlashAttention** (IO-aware, tiled), **speculative decoding**, and **Mixture-of-Experts** (sparse routing, load-balancing loss).",
        "This is where ML becomes a distributed-systems and GPU problem — the techniques that make billion-parameter training feasible.",
      ],
      resources: [
        { label: "FlashAttention (paper)", url: "https://arxiv.org/abs/2205.14135", type: "paper" },
        { label: "Hugging Face — performance & scaling guide", url: "https://huggingface.co/docs/transformers/en/performance", type: "docs" },
        { label: "Ultra-Scale Playbook — HF (distributed training)", url: "https://huggingface.co/spaces/nanotron/ultrascale-playbook", type: "docs" },
      ],
      connections: [
        { to: "gpu-distributed", note: "Tensor/pipeline parallelism + NCCL collectives are the GPU-systems view" },
        { to: "gpu-fusion", note: "FlashAttention is the marquee fused GPU kernel" },
        { to: "web-systemdesign", note: "Multi-node training is a distributed-systems orchestration problem" },
      ],
    },
    {
      id: "ai-mlops",
      title: "MLOps: serving & evaluation",
      level: "Advanced",
      body: [
        "Experiment tracking (MLflow, W&B), model serving (Triton Inference Server, ONNX), deployment quantization (bitsandbytes, llama.cpp, **vLLM/PagedAttention**), evaluation (perplexity/BLEU/ROUGE and why they're insufficient → human eval, **LLM-as-judge**), and data pipelines (Arrow, streaming datasets).",
        "Plus **RAG**: embeddings + vector DB + retrieval + grounded generation with citations.",
      ],
      resources: [
        { label: "vLLM — documentation", url: "https://docs.vllm.ai/", type: "docs" },
        { label: "Weights & Biases — guides", url: "https://docs.wandb.ai/", type: "docs" },
        { label: "Made With ML — MLOps course (free)", url: "https://madewithml.com/", type: "course" },
      ],
      connections: [
        { to: "web-backend", note: "Serving endpoints reuse the API/auth/rate-limit patterns from backend" },
        { to: "gpu-inference", note: "vLLM/PagedAttention is the GPU-systems heart of LLM serving" },
        { to: "web-databases", note: "RAG depends on vector DBs and retrieval indexing" },
      ],
    },
    {
      id: "ai-interp",
      title: "Mechanistic interpretability & alignment",
      level: "Research",
      body: [
        "**Mech interp**: circuits, the **superposition** hypothesis, sparse autoencoders, activation patching, and tooling (TransformerLens). **Alignment**: constitutional AI, scalable oversight, debate/amplification. Plus research math: neural ODEs, diffusion-as-SDE, and the in-context-learning-as-implicit-gradient-descent hypothesis.",
        "This is treating trained models as objects to be reverse-engineered — the science of understanding what networks actually compute.",
      ],
      resources: [
        { label: "Anthropic — Transformer Circuits", url: "https://transformer-circuits.pub/", type: "docs", note: "the core interpretability research" },
        { label: "Neel Nanda — Mechanistic Interpretability", url: "https://www.neelnanda.io/mechanistic-interpretability", type: "docs" },
        { label: "ARENA — Alignment Research Engineer curriculum", url: "https://www.arena.education/", type: "course" },
      ],
      connections: [
        { to: "cyber-re", note: "Mech interp is reverse engineering applied to neural network weights" },
        { to: "comp-ssa", note: "Tracing circuits resembles dataflow analysis over a computation graph" },
      ],
    },
  ],
});
