atlasAdd({
  id: "quant",
  num: 11,
  title: "Quant Finance & Trading",
  icon: "📈",
  color: "#7aa2f7",
  tagline: "From financial math to HFT infrastructure, alternative data, and portfolio optimization.",
  overview: [
    "Quant finance is the most adversarial application of statistics there is: every edge decays as others find it, the data is non-stationary, and overfitting is the default outcome. The core skill is intellectual honesty under uncertainty — realistic backtests, proper cross-validation, and respect for transaction costs.",
    "It's a genuine integration domain: probability/stats (shared with ML), stochastic calculus (shared with diffusion models), low-latency systems (shared with low-level/HFT), and increasingly on-chain microstructure (shared with web3). The arc: markets & financial math → statistical rigor & options → microstructure, HFT, and ML-driven alpha.",
  ],
  topics: [
    {
      id: "quant-markets",
      title: "Market mechanics & financial math",
      level: "Beginner",
      body: [
        "Asset classes and how each trades, **order types** (market/limit/stop/IOC/FOK — what each guarantees), the **order book** (bids/asks/spread/depth), exchange vs OTC, and settlement. Then financial math: **log returns** (why — additivity), CAGR vs average return, time value of money, the higher moments (skew/kurtosis = fat tails), and **drawdown** (often more important than Sharpe).",
        "Get the vocabulary and the return math exactly right before touching a strategy.",
      ],
      resources: [
        { label: "Hull — Options, Futures, and Other Derivatives", url: "https://www.pearson.com/en-us/subject-catalog/p/options-futures-and-other-derivatives/P200000005938", type: "book", note: "the standard reference" },
        { label: "QuantConnect — Bootcamp & docs (free)", url: "https://www.quantconnect.com/learning/", type: "course" },
      ],
      connections: [
        { to: "quant-strategies", note: "Order types and the book are what your strategy actually interacts with" },
        { to: "web3-defi", note: "On-chain AMMs replace the order book with a bonding curve — same questions" },
      ],
    },
    {
      id: "quant-strategies",
      title: "Strategies & honest backtesting",
      level: "Beginner → Intermediate",
      body: [
        "Vectorized backtesting (shifted returns for signal lag), the classic strategies (MA crossover — and why it loses; RSI/Bollinger as transformed price, not signal; **momentum** 12-1; **mean reversion**/pairs), and — most important — the **backtesting pitfalls**: look-ahead bias, survivorship bias, overfitting, and realistic transaction costs.",
        "Building your own backtester (with slippage and commission) teaches more than any library, because you control every assumption.",
      ],
      resources: [
        { label: "Python for Finance — Yves Hilpisch (book)", url: "https://home.tpq.io/books/py4fi/", type: "book" },
        { label: "Ernie Chan — Quantitative Trading (intro)", url: "https://www.epchan.com/books/", type: "book" },
      ],
      connections: [
        { to: "quant-stats", note: "Avoiding overfit demands the time-series CV from statistics" },
        { to: "dsa-foundations", note: "Vectorized backtesting is NumPy/pandas array programming" },
      ],
    },
    {
      id: "quant-stats",
      title: "Statistical methods for finance",
      level: "Intermediate",
      body: [
        "Time-series properties (**stationarity**: ADF/KPSS, ACF/PACF), **ARIMA**, **GARCH** (volatility clustering, conditional variance), regime detection (HMM, Kalman filter), **cointegration** (Engle-Granger/Johansen — real pairs trading), and the methodology that matters most: **walk-forward validation with purging and embargo** to prevent leakage.",
        "Finance breaks naive ML because the data is non-stationary and time-ordered — this topic is the fix.",
      ],
      resources: [
        { label: "Advances in Financial Machine Learning — López de Prado", url: "https://www.wiley.com/en-us/Advances+in+Financial+Machine+Learning-p-9781119482086", type: "book", note: "the essential book" },
        { label: "Kalman & Bayesian Filters in Python (free)", url: "https://github.com/rlabbe/Kalman-and-Bayesian-Filters-in-Python", type: "repo" },
      ],
      connections: [
        { to: "ai-math", note: "Distributions, MLE and covariance are shared with ML's math base" },
        { to: "quant-ml", note: "Purging/embargo are what make ML-for-trading not leak" },
      ],
    },
    {
      id: "quant-factors",
      title: "Factor models",
      level: "Intermediate",
      body: [
        "CAPM (beta/alpha, its empirical failure), **Fama-French** 3/5-factor (market, SMB, HML, RMW, CMA), Carhart momentum, factor construction (sorted long-short portfolios, **information coefficient**, factor decay), Barra-style risk models, and APT.",
        "Replicating a published factor from raw data is the project that separates 'read about it' from 'can do it'.",
      ],
      resources: [
        { label: "Kenneth French — Data Library (factor data)", url: "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html", type: "tool" },
        { label: "Active Portfolio Management — Grinold & Kahn", url: "https://www.mhprofessional.com/active-portfolio-management-a-quantitative-approach-for-producing-superior-returns-and-controlling-risk-9780070248823-usa", type: "book" },
      ],
      connections: [
        { to: "quant-portfolio", note: "Factor exposures feed risk models and portfolio optimization" },
        { to: "ai-math", note: "PCA/eigendecomposition underpins statistical risk factors" },
      ],
    },
    {
      id: "quant-options",
      title: "Options & derivatives pricing",
      level: "Intermediate → Advanced",
      body: [
        "Payoffs and moneyness, **Black-Scholes** (derive via replicating portfolio / risk-neutral pricing), the **Greeks** (delta/gamma/vega/theta/rho), implied vol and the **vol smile/skew**, the **binomial tree** (backward induction — DP!), **Monte Carlo** pricing (GBM, variance reduction), and exotics.",
        "Options are where probability, PDEs, and DP meet; building a pricing library with Greeks is the milestone.",
      ],
      resources: [
        { label: "Hull — Options, Futures, and Other Derivatives", url: "https://www-2.rotman.utoronto.ca/~hull/", type: "book" },
        { label: "QuantPy / Quantitative finance tutorials", url: "https://quantpy.com.au/", type: "docs" },
      ],
      connections: [
        { to: "dsa-paradigms", note: "Binomial pricing is backward-induction dynamic programming on a tree" },
        { to: "ai-diffusion", note: "GBM/SDE simulation shares Itô calculus with diffusion models" },
        { to: "quant-portfolio", note: "Greeks drive hedging and portfolio-level risk" },
      ],
    },
    {
      id: "quant-portfolio",
      title: "Portfolio construction & risk",
      level: "Advanced",
      body: [
        "**Markowitz** mean-variance (efficient frontier) and its failure (estimation error, ill-conditioned covariance), **Black-Litterman**, **risk parity**, the **Kelly criterion** (and fractional Kelly), **CVaR** optimization, and risk management (VaR vs Expected Shortfall, stress testing, volatility targeting).",
        "Optimization here is convex programming (cvxpy); the lesson is that estimation error usually dominates clever objectives.",
      ],
      resources: [
        { label: "cvxpy — convex optimization in Python (docs)", url: "https://www.cvxpy.org/", type: "docs" },
        { label: "Robust portfolio optimization — Boyd notes (Stanford)", url: "https://web.stanford.edu/~boyd/papers/cvx_short_course.html", type: "course" },
      ],
      connections: [
        { to: "quant-factors", note: "Factor risk models supply the covariance structure for optimization" },
        { to: "ai-classical", note: "Convex optimization and regularization are shared with ML" },
      ],
    },
    {
      id: "quant-microstructure",
      title: "Market microstructure",
      level: "Advanced",
      body: [
        "Price formation (informed vs uninformed traders, adverse selection), the **Kyle model** (lambda = price impact), Glosten-Milgrom (spread from adverse selection), order-flow imbalance, trade classification (Lee-Ready), and limit-order-book dynamics (arrival/cancellation rates, queue position).",
        "This is the physics of how prices actually move at short horizons — the foundation for execution and market making.",
      ],
      resources: [
        { label: "Algorithmic and High-Frequency Trading — Cartea, Jaimungal, Penalva", url: "https://www.cambridge.org/core/books/algorithmic-and-highfrequency-trading/", type: "book" },
        { label: "Trades, Quotes and Prices — Bouchaud et al.", url: "https://www.cambridge.org/core/books/trades-quotes-and-prices/", type: "book" },
      ],
      connections: [
        { to: "ai-rl", note: "RL for optimal execution / market making builds on microstructure models" },
        { to: "quant-hft", note: "Microstructure signals are what HFT infrastructure acts on" },
      ],
    },
    {
      id: "quant-hft",
      title: "High-frequency trading infrastructure",
      level: "Advanced",
      body: [
        "HFT strategies (market making, latency/statistical arb), where **latency** comes from (colocation, kernel bypass, **FPGA**, microwave links), the network stack (UDP market data, **DPDK**/Solarflare OpenOnload), FPGA market-data parsing, market-making P&L decomposition, and the **Avellaneda-Stoikov** optimal-MM model.",
        "This is where quant becomes a low-level systems problem — nanoseconds and lock-free code decide profitability.",
      ],
      resources: [
        { label: "Avellaneda-Stoikov — High-frequency trading in a limit order book (paper)", url: "https://www.math.nyu.edu/~avellane/HighFrequencyTrading.pdf", type: "paper" },
        { label: "Algorithmic Trading and DMA — Barry Johnson", url: "https://www.algo-dma.com/", type: "book" },
      ],
      connections: [
        { to: "ll-kernelbypass", note: "DPDK/Solarflare kernel-bypass is shared verbatim with low-level systems" },
        { to: "ll-concurrency", note: "Lock-free queues are mandatory in the trading hot path" },
        { to: "emb-hardware", note: "FPGA in HFT overlaps embedded/hardware design (HLS, timing)" },
      ],
    },
    {
      id: "quant-altdata",
      title: "Alternative data",
      level: "Advanced",
      body: [
        "Data types (satellite, credit-card, web-scraped, shipping AIS, earnings-call NLP), acquisition (Scrapy/Playwright, vendor negotiation), point-in-time construction (avoiding survivorship/look-ahead), **NLP for finance** (FinBERT/Sec-BERT, sentiment from 10-Ks, event studies), and signal decay.",
        "Edge increasingly comes from unique data plus the engineering to clean it without leakage.",
      ],
      resources: [
        { label: "SEC EDGAR — full-text filings (data source)", url: "https://www.sec.gov/search-filings", type: "tool" },
        { label: "FinBERT — financial sentiment model", url: "https://huggingface.co/ProsusAI/finbert", type: "repo" },
      ],
      connections: [
        { to: "ai-llm", note: "Earnings-call / filing NLP uses transformer language models" },
        { to: "web-backend", note: "Scraping pipelines (Playwright/Scrapy) are web-engineering" },
      ],
    },
    {
      id: "quant-ml",
      title: "Machine learning for trading",
      level: "Advanced → Research",
      body: [
        "Feature engineering (indicators as features — carefully), label construction (forward returns, the **triple-barrier** method), **purging/embargo** in CV, feature importance (SHAP, permutation), gradient boosting for tabular alpha, sequence models (TFT, N-BEATS), and the central enemy: **overfitting** (combinatorial purged CV).",
        "The techniques are standard ML; what's specific is the relentless defense against leakage and false discovery.",
      ],
      resources: [
        { label: "Advances in Financial ML — López de Prado (code)", url: "https://github.com/hudson-and-thames/mlfinlab", type: "repo" },
        { label: "Stochastic Calculus for Finance — Shreve (vol I & II)", url: "https://link.springer.com/book/10.1007/978-0-387-22527-2", type: "book" },
      ],
      connections: [
        { to: "ai-classical", note: "LightGBM on tabular features is the core ML-for-trading model" },
        { to: "quant-stats", note: "Purging/embargo and walk-forward CV come from finance statistics" },
        { to: "ai-rl", note: "RL for execution/market making is the research frontier" },
      ],
    },
  ],
});
