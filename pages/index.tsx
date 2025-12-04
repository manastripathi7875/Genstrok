import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Button, Card, CardImage, CardContent, Loading, EmptyState } from "../components/UI";

interface Item {
  id: number;
  title: string;
  price: number;
  stock: number;
  cover_url: string;
}

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("Items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Error:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }

  async function handleClaim(item: Item) {
    if (item.stock <= 0) return;
    
    setClaimingId(item.id);
    setMessage("");

    const { error } = await supabase
      .from("Items")
      .update({ stock: item.stock - 1 })
      .eq("id", item.id);

    if (error) {
      setMessage("Error claiming item: " + error.message);
    } else {
      setMessage(`Successfully claimed: ${item.title}`);
      fetchItems();
    }
    setClaimingId(null);
  }

  return (
    <main className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="mb-6">
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-protera-700">
                  Protera Marketplace
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  Browse and claim items from our collection
                </p>
              </div>
              <a
                href="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Admin
              </a>
            </div>
          </CardContent>
        </Card>

        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            message.includes("Error") 
              ? "bg-red-50 text-red-600" 
              : "bg-green-50 text-green-600"
          }`}>
            {message}
          </div>
        )}

        {loading ? (
          <Card>
            <Loading size="lg" text="Loading items..." />
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              title="No items available"
              description="Check back later for new items"
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((item) => {
              const isOutOfStock = item.stock <= 0;
              const isClaiming = claimingId === item.id;
              
              return (
                <Card key={item.id}>
                  <CardImage
                    src={item.cover_url || `https://picsum.photos/seed/${item.id}/400/300`}
                    alt={item.title}
                  />
                  <CardContent>
                    <h3 className="font-semibold text-lg text-protera-700">
                      {item.title}
                    </h3>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xl font-bold text-blue-600">
                        ₹{item.price}
                      </span>
                      <span className={`text-sm ${
                        isOutOfStock ? "text-red-500" : "text-gray-500"
                      }`}>
                        {isOutOfStock ? "Out of stock" : `${item.stock} in stock`}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleClaim(item)}
                      disabled={isOutOfStock || isClaiming}
                      loading={isClaiming}
                      className="w-full mt-4"
                    >
                      {isOutOfStock ? "Out of Stock" : "Claim"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
