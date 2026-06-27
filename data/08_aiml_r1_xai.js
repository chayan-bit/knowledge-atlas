atlasAdd({
  id: "aiml",
  topics: [
    {
      id: "ai-xai",
      title: "Classical XAI: LIME, SHAP, Grad-CAM & TCAV",
      level: "Research",
      body: [
        "**Explainable AI (XAI)** is the discipline of making model decisions human-interpretable, either post-hoc (explaining a trained model) or by design (inherently interpretable models). Classical XAI focuses on the former: given any black-box $f$, produce explanations of the form 'the model predicted $y$ because of features $x_1, x_3$'.",
        "The central tension: *faithfulness* (does the explanation reflect what the model actually computed?) vs *plausibility* (does it match human reasoning patterns?). These are not the same. A paper by Lipton (2018) named this the 'mythos of model interpretability' and remains mandatory reading after touching any XAI method.",
      ],
      subtopics: [
        {
          title: "LIME: Local Linear Approximations of Black-Box Models",
          body: [
            "**LIME (Locally Interpretable Model-agnostic Explanations)** (Ribeiro et al., 2016) answers: for a specific input $x_0$, which features drove the prediction? The key insight is that even a highly non-linear model $f$ is approximately linear in a small neighbourhood around any given point. LIME exploits this by fitting a sparse linear model $g$ to approximate $f$ locally, then reporting $g$'s coefficients as the explanation.",
            "**Algorithm**: (1) Sample perturbations $z'$ around $x_0$ in an interpretable input space (e.g., superpixels for images, word presence for text). (2) Map each $z'$ back to the original feature space as $z$ and query the black-box: $f(z)$. (3) Weight each sample by proximity to $x_0$ using an exponential kernel $\\pi_{x_0}(z) = \\exp(-D(x_0, z)^2 / \\sigma^2)$ where $D$ is a distance metric. (4) Fit a sparse linear model $g$ by solving the weighted LASSO: $$\\text{argmin}_{g \\in G} \\mathcal{L}(f, g, \\pi_{x_0}) + \\Omega(g)$$ where $\\mathcal{L}$ is weighted squared loss and $\\Omega(g)$ penalises the complexity of $g$ (e.g., $\\|w_g\\|_0 \\leq K$ for at most $K$ non-zero weights). The coefficients of $g$ are the LIME explanation.",
            "**Image LIME** partitions images into superpixels (contiguous regions of similar colour via SLIC) and perturbs by toggling superpixels on/off (replacing 'off' superpixels with grey or mean colour). The linear model then assigns a positive or negative weight to each superpixel, directly showing which image regions pushed the prediction up or down. **Text LIME** perturbs by removing words; each word gets a signed weight.",
            "**Limitations are fundamental, not incidental**: (i) *Instability* - the sampling procedure is stochastic, so re-running LIME on the same instance gives different explanations. (ii) *Neighbourhood definition* - the choice of kernel width $\\sigma$ and what 'neighbourhood' means is arbitrary and strongly influences results. (iii) *Faithfulness gap* - the linear approximation may be poor if $f$ is highly non-linear locally; you cannot know this without ground truth. (iv) *Feature independence assumption* - LIME treats features as independent in its perturbation, which ignores correlations. These limitations motivated SHAP.",
            "**The trust question**: Ribeiro et al. found that LIME explanations help humans identify whether to trust a specific prediction. In their famous 'Husky vs Wolf' example, LIME revealed that a high-accuracy wolf/husky classifier was actually using snow in the background as its primary feature — a shortcut the model had learned from dataset bias. Without LIME, the 99% accuracy would have been misleading. This is XAI's practical value: not just explaining correct predictions, but exposing model failures.",
          ],
          resources: [
            { label: "Ribeiro et al. — 'Why Should I Trust You?' LIME paper (2016)", url: "https://arxiv.org/abs/1602.04938", type: "paper" },
            { label: "LIME GitHub repository with worked examples", url: "https://github.com/marcotcr/lime", type: "repo" },
          ],
        },
        {
          title: "SHAP: Shapley Values and Unified Feature Attribution",
          body: [
            "**SHAP (SHapley Additive exPlanations)** (Lundberg & Lee, 2017) grounds feature attribution in **cooperative game theory**. A Shapley value $\\phi_i(v)$ for player $i$ in a game with value function $v$ is the unique attribution satisfying four axioms: *efficiency* (attributions sum to the total payout), *symmetry* (identical players get equal credit), *dummy* (a player who contributes nothing gets zero), and *linearity* (attributions are additive over independent games). Lundberg & Lee showed that among all additive feature attribution methods, SHAP values are the **unique** method satisfying these axioms.",
            "**Mathematical definition**: For model $f$ and instance $x$, the Shapley value of feature $i$ is: $$\\phi_i(f, x) = \\sum_{S \\subseteq F \\setminus \\{i\\}} \\frac{|S|!(|F|-|S|-1)!}{|F|!} \\left[ f_{S \\cup \\{i\\}}(x_{S \\cup \\{i\\}}) - f_S(x_S) \\right]$$ where $F$ is the full feature set, $S$ ranges over all subsets excluding feature $i$, and $f_S(x_S)$ is the model's expected output when only features in $S$ are known (others are marginalised out). The intuition: $\\phi_i$ is the average marginal contribution of feature $i$ across all possible orderings in which features join the 'coalition'.",
            "**Exact Shapley values are exponential** in the number of features ($2^{|F|}$ subsets). SHAP's practical power comes from model-specific approximations. **TreeSHAP** (for tree ensembles) computes exact Shapley values in $O(TLD^2)$ time where $T$ is the number of trees, $L$ is leaves, $D$ is depth — polynomial, not exponential. **KernelSHAP** is model-agnostic and uses a weighted linear regression trick: the Shapley kernel weight for a coalition $S$ is $\\kappa(S) = \\frac{|F|-1}{\\binom{|F|}{|S|}|S|(|F|-|S|)}$, which makes the kernel regression exactly recover Shapley values in expectation. **LinearSHAP** exploits linear model structure for exact computation.",
            "**SHAP enables global explanations** by aggregating local ones. A **SHAP summary plot** shows each feature's Shapley value distribution across the dataset: the x-axis is the SHAP value (impact on output), the y-axis is the feature, and colour encodes the feature value (red=high, blue=low). A **SHAP dependence plot** for feature $i$ shows $\\phi_i$ vs $x_i$, revealing non-linear effects. **SHAP interaction values** decompose the contribution of feature pairs $(i, j)$ jointly, capturing interaction effects that univariate attribution misses: $$\\phi_{ij}(f,x) = \\sum_{S \\subseteq F \\setminus \\{i,j\\}} \\frac{|S|!(|F|-|S|-2)!}{2(|F|-1)!} \\delta_{ij}(f, S, x)$$",
            "**Critical limitation**: the marginalisation of 'unknown' features ($f_S(x_S)$) requires a choice. The **interventional** approach replaces missing features with samples from the marginal distribution (ignoring correlations), while the **conditional** approach conditions on available features. These give different Shapley values and different explanations. For correlated features (e.g., height and weight), conditional SHAP attributes more to the correlated group while interventional SHAP can assign implausible feature combinations. Neither is uniquely 'correct' — they answer different causal questions.",
          ],
          resources: [
            { label: "Lundberg & Lee — SHAP paper (2017)", url: "https://arxiv.org/abs/1705.07874", type: "paper" },
            { label: "SHAP documentation with visual explanation guides", url: "https://shap.readthedocs.io/", type: "docs" },
            { label: "TreeSHAP paper — polynomial-time exact Shapley for trees", url: "https://www.nature.com/articles/s42256-019-0138-9", type: "paper" },
          ],
        },
        {
          title: "Grad-CAM: Gradient-Weighted Class Activation Mapping",
          body: [
            "**Grad-CAM (Gradient-weighted Class Activation Mapping)** (Selvaraju et al., 2017) produces **visual explanations** for CNN decisions by highlighting which spatial regions of an input image were most important for a predicted class. Unlike LIME and SHAP, Grad-CAM is not model-agnostic — it requires access to gradients and is designed specifically for convolutional networks. Its advantage is speed and the naturalness of the output: a heatmap over the input image.",
            "**Algorithm**: Let $A^k \\in \\mathbb{R}^{u \\times v}$ be the $k$-th feature map of the last convolutional layer, and let $y^c$ be the class score for class $c$ before softmax. Grad-CAM computes the gradient of $y^c$ with respect to each feature map: $\\frac{\\partial y^c}{\\partial A^k_{ij}}$. The **importance weight** for feature map $k$ is the global average pooling of these gradients: $$\\alpha_k^c = \\frac{1}{Z} \\sum_i \\sum_j \\frac{\\partial y^c}{\\partial A^k_{ij}}$$ The Grad-CAM heatmap is then: $$L^c_{\\text{Grad-CAM}} = \\text{ReLU}\\left( \\sum_k \\alpha_k^c A^k \\right)$$ The ReLU discards channels with negative influence (which would indicate evidence *against* the class). The heatmap is upsampled to input resolution via bilinear interpolation.",
            "The ReLU is crucial: without it, you get a map of all activations weighted by gradient magnitude, including those that argue against the class. The ReLU makes Grad-CAM class-discriminative — the same network produces different heatmaps for 'cat' vs 'dog' on the same image. **Guided Grad-CAM** combines Grad-CAM with **guided backpropagation** (which ReLU-gates gradient flow at activation sites as well) for fine-grained pixel-level explanations.",
            "**Why does Grad-CAM work?** The last convolutional layer typically has the highest semantic content (it is closest to the class decision) while retaining spatial information (unlike fully-connected layers which pool everything). The weights $\\alpha_k^c$ measure how important each feature map is for class $c$: a feature map that fires strongly for edges in the 'car' class will have high gradient when the car class score changes. The weighted combination thus highlights the spatial regions that the most class-relevant feature maps activate on.",
            "**Limitations and variants**: (i) Grad-CAM is coarse — it operates at the resolution of the last conv layer (e.g., 7×7 for ResNet-50 with 224×224 input). (ii) It can be deceived: Fooling a network while maintaining Grad-CAM explanations (adversarial manipulations that change the prediction without changing the heatmap) has been demonstrated. (iii) **Score-CAM** replaces gradients with forward pass activation scores, avoiding issues with saturated gradients. (iv) **EigenGradCAM** uses the first principal component of the gradients. (v) For transformers, **Attention Rollout** and **Generic Attention-model Explainability** are the analogues.",
          ],
          resources: [
            { label: "Selvaraju et al. — Grad-CAM paper (2017)", url: "https://arxiv.org/abs/1610.02391", type: "paper" },
            { label: "pytorch-grad-cam library with multi-method support", url: "https://github.com/jacobgil/pytorch-grad-cam", type: "repo" },
          ],
        },
        {
          title: "TCAV: Testing with Concept Activation Vectors",
          body: [
            "**TCAV (Testing with Concept Activation Vectors)** (Kim et al., 2018) takes a fundamentally different approach to XAI: rather than asking 'which input features matter?', it asks '**which high-level human concepts** does the model use?'. For instance: did the model use the concept of 'stripes' to classify zebras? Did it use 'gender' to predict salary? TCAV enables testing hypotheses about model internals using concepts that humans define, not low-level pixel features.",
            "**Algorithm**: (1) Define a **concept** as a set of example images (e.g., images of striped objects). Define a **random** counter-example set (random images). (2) Train a **linear binary classifier** (an SVM) to separate concept examples from random examples in the activation space of layer $l$: $$h_{C,l}: \\mathbb{R}^{d_l} \\rightarrow \\{0, 1\\}$$ The normal vector to the decision boundary in activation space is the **Concept Activation Vector (CAV)** $v_{C,l} \\in \\mathbb{R}^{d_l}$. (3) Compute the **TCAV score**: the fraction of inputs in class $k$ for which the directional derivative of the class logit with respect to the concept direction is positive: $$\\text{TCAV}_{Q_{C,k,l}} = \\frac{|\\{x \\in X_k : S_{C,k,l}(x) > 0\\}|}{|X_k|}$$ where $S_{C,k,l}(x) = \\nabla h_{C,l}(f_l(x)) \\cdot v_{C,l}$ is the directional derivative.",
            "A TCAV score of 0.8 for concept 'stripes' in layer $l$ for class 'zebra' means that 80% of zebra images have their class score *increase* when moved in the 'stripes' direction in activation space — the model uses stripes to identify zebras. A TCAV score near 0.5 means the concept is uncorrelated with the class decision. TCAV uses **two-sided hypothesis testing** (comparing against random CAV directions) to determine statistical significance.",
            "**Why linear probes?** The CAV must be a *linear* separator in activation space. This is justified by the **linear representation hypothesis**: that meaningful concepts in neural networks tend to be linearly separable in intermediate activation spaces. If this does not hold, the CAV is not a valid proxy for the concept. This hypothesis is central to mechanistic interpretability too and is the reason linear probes are extensively used across the field.",
            "**Applications and limitations**: TCAV has been used to audit medical AI (does a skin cancer classifier use the concept 'ruler' — a photographic artefact correlated with malignancy in training data?), audit credit scoring models for demographic concepts, and understand what features transformers encode at each layer. Limitations: concept sets must be human-curated (expensive), the linear separability assumption may fail, and TCAV scores can be sensitive to the choice of concept examples. **Net Dissect** is a related method that automatically discovers which neurons in a network correspond to human-defined concept categories from a labelled concept dataset.",
          ],
          resources: [
            { label: "Kim et al. — TCAV paper (2018)", url: "https://arxiv.org/abs/1711.11279", type: "paper" },
            { label: "Lipton — The Mythos of Model Interpretability (2018)", url: "https://arxiv.org/abs/1606.03490", type: "paper" },
            { label: "Doshi-Velez & Kim — Towards a Rigorous Science of Interpretable ML (2017)", url: "https://arxiv.org/abs/1702.08608", type: "paper" },
          ],
        },
        {
          title: "Christoph Molnar's IML Framework and Evaluation of Explanations",
          body: [
            "**Interpretable Machine Learning** (Molnar, 2020+) systematically classifies explanation methods along several axes: *model-agnostic* (LIME, SHAP, PDP) vs *model-specific* (Grad-CAM, attention weights); *local* (explain one prediction) vs *global* (explain the full model behaviour); *post-hoc* (after training) vs *intrinsic* (interpretable by design, e.g. linear models, shallow decision trees). Navigating these distinctions is required to choose the right method for a use case.",
            "**Partial Dependence Plots (PDPs)** show the marginal effect of one or two features on the predicted outcome, averaging over all other features: $\\hat{f}_{x_S}(x_S) = \\mathbb{E}_{x_C}[\\hat{f}(x_S, x_C)] = \\int \\hat{f}(x_S, x_C) d\\mathbb{P}(x_C)$, estimated by averaging $\\frac{1}{n}\\sum_{i=1}^n \\hat{f}(x_S, x_C^{(i)})$ over training data. **ICE (Individual Conditional Expectation) plots** show one line per data point instead of the average, revealing heterogeneity that PDPs hide. **ALEPlots (Accumulated Local Effects)** fix a known problem: PDPs marginalise over the joint distribution of $(x_S, x_C)$, including combinations that never appear in training data, producing misleading plots for correlated features. ALEs instead accumulate local effects within a small window around $x_S$.",
            "**Counterfactual explanations** answer: 'What would need to change in $x$ for the prediction to flip to $y'$?' Formally: find $x'$ minimising $d(x, x')$ subject to $f(x') = y'$ and $x'$ being realistic. The **Wachter et al. (2017)** objective is: $$\\min_{x'} \\max_{\\lambda} \\lambda(f(x') - y')^2 + d(x, x')$$ Counterfactuals are actionable (they suggest concrete changes) and privacy-preserving (they do not require model internals). They are the basis of many regulatory 'right to explanation' implementations. Challenge: there may be many valid counterfactuals (the **Rashomon set**), and the choice among them is non-trivial.",
            "**Evaluating explanations** is the deepest open problem in XAI. Proposed criteria: *faithfulness* (does the explanation match the model's actual computations — measurable via 'faithfulness perturbation tests' that ablate top-k features and measure prediction change); *completeness* (does the explanation account for all model behaviour); *stability* (do nearby inputs get similar explanations); *comprehensibility* (can a human understand and use the explanation). Doshi-Velez & Kim (2017) formalise these as application-grounded (human studies), human-grounded (simplified tasks with humans), and functionally-grounded (proxy metrics without humans) evaluations. The honest conclusion: no single metric captures explanation quality, and the field remains without a ground truth.",
          ],
          resources: [
            { label: "Christoph Molnar — Interpretable Machine Learning (free online book)", url: "https://christophm.github.io/interpretable-ml-book/", type: "book" },
            { label: "Doshi-Velez & Kim — Rigorous Science of Interpretable ML (2017)", url: "https://arxiv.org/abs/1702.08608", type: "paper" },
            { label: "Wachter et al. — Counterfactual Explanations (2017)", url: "https://arxiv.org/abs/1711.00399", type: "paper" },
          ],
        },
      ],
      resources: [
        { label: "Christoph Molnar — Interpretable Machine Learning (full book)", url: "https://christophm.github.io/interpretable-ml-book/intro.html", type: "book" },
        { label: "LIME paper — Ribeiro et al. 2016", url: "https://arxiv.org/abs/1602.04938", type: "paper" },
        { label: "SHAP paper — Lundberg & Lee 2017", url: "https://arxiv.org/abs/1705.07874", type: "paper" },
        { label: "SHAP visual docs", url: "https://shap.readthedocs.io/", type: "docs" },
        { label: "TCAV paper — Kim et al. 2018", url: "https://arxiv.org/abs/1711.11279", type: "paper" },
        { label: "Grad-CAM paper — Selvaraju et al. 2017", url: "https://arxiv.org/abs/1610.02391", type: "paper" },
        { label: "Lipton — Mythos of Model Interpretability 2018", url: "https://arxiv.org/abs/1606.03490", type: "paper" },
      ],
      connections: [
        { to: "ai-interp", note: "Classical XAI and mechanistic interpretability answer different questions about the same models" },
        { to: "ai-nn", note: "Grad-CAM requires access to CNN gradients and activations" },
        { to: "ai-cv", note: "Most classical XAI methods were developed for vision models" },
        { to: "ai-adversarial", note: "Adversarial examples expose the gap between XAI explanations and actual model behaviour" },
      ],
    },
  ],
});
