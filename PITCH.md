# Pitch

Lattice lets a company's customers fund that company's working-capital credit line.

Customers deposit USDC into a company-specific pool and receive NAV-based shares. Chainlink
Confidential AI underwrites the company's credit cap and APR from private financial inputs plus its
onchain repayment track record. The company draws from the pool and pays interest. Interest raises
NAV, so customers earn the spread. If the company defaults, the pool writes down principal and NAV
falls.

The wedge is simple: customers who believe in a company can finance it directly without becoming
equity holders. It is debt, not tokenized equity. It is undercollateralized, unlike Aave. It is
community-funded, unlike institutional private-credit pools.

Arc handles USDC settlement. Chainlink handles confidential underwriting and delivery of cap plus
rate. The contract handles NAV shares, liquidity reserve, repayment accounting, and default loss.
