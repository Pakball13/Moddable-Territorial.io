import json, torch, torch.nn as nn, numpy as np
from torch.utils.data import DataLoader, TensorDataset

with open("bot-training-data-1760189531221.json") as f:
    data = json.load(f)

X = np.array([s["features"] for s in data["samples"]], dtype=np.float32)
y_reg = np.array([[s["action"]["committedFrac"]] for s in data["samples"]], dtype=np.float32)
y_cls = (y_reg > 0.05).astype(np.float32)

class BotPolicy(nn.Module):
    def __init__(self, n_in):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_in, 64), nn.ReLU(),
            nn.Linear(64, 64),   nn.ReLU(),
            nn.Linear(64, 32),   nn.ReLU()
        )
        self.attack_head = nn.Linear(32, 1)   # sigmoid → probability
        self.amount_head = nn.Linear(32, 1)   # sigmoid → fraction

    def forward(self, x):
        h = self.net(x)
        return torch.sigmoid(self.attack_head(h)), torch.sigmoid(self.amount_head(h))

model = BotPolicy(X.shape[1])
opt = torch.optim.Adam(model.parameters(), lr=1e-3)
loss_fn = nn.BCELoss()

ds = TensorDataset(torch.from_numpy(X), torch.from_numpy(y_cls), torch.from_numpy(y_reg))
dl = DataLoader(ds, batch_size=128, shuffle=True)

for epoch in range(30):
    total = 0
    for xb, yb_cls, yb_reg in dl:
        opt.zero_grad()
        p_attack, p_amount = model(xb)
        loss = loss_fn(p_attack, yb_cls) + loss_fn(p_amount, yb_reg)
        loss.backward(); opt.step()
        total += loss.item()
    print(f"epoch {epoch:2d}  loss {total/len(dl):.4f}")

# Export weights as JSON for the browser
weights = {}
for name, param in model.named_parameters():
    weights[name] = param.detach().numpy().tolist()
with open("policy.json", "w") as f:
    json.dump({"version": 1, "weights": weights}, f)

print("saved policy.json")