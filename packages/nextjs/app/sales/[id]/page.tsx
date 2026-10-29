"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ArrowLeftIcon, ClockIcon, TagIcon, TicketIcon, UserIcon } from "@heroicons/react/24/outline";
import { AddressDisplay, DateRangeDisplay, HbarAmount } from "~~/components/marketplace";
import { useScaffoldEventHistory, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";
import {
  GAS_LIMITS,
  ZERO_ADDRESS,
  formatHbar,
  hbarToTinybars,
  parseSubscription,
  tinybarsToWei,
} from "~~/utils/hedera";

enum ListingType {
  FixedPrice = 0,
  Auction = 1,
}

enum ListingStatus {
  Active = 0,
  Sold = 1,
  Cancelled = 2,
}

const formatTimeRemaining = (endTime: bigint): string => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (endTime <= now) return "Ended";

  const remaining = Number(endTime - now);
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export default function SalesListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address: connectedAddress } = useAccount();
  const listingId = BigInt(params.id as string);

  const [bidAmount, setBidAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  const { data: listingData, isLoading: isLoadingListing } = useScaffoldReadContract({
    contractName: "SubscriptionSalesMarketplace",
    functionName: "getListing",
    args: [listingId],
  });

  const { data: minimumBid } = useScaffoldReadContract({
    contractName: "SubscriptionSalesMarketplace",
    functionName: "getMinimumBid",
    args: [listingId],
    query: { enabled: listingData ? Number(listingData.listingType) === ListingType.Auction : false },
  });

  const serialNumber = listingData?.serialNumber;

  const { data: subscriptionRaw } = useScaffoldReadContract({
    contractName: "SubscriptionNFT",
    functionName: "getSubscription",
    args: [serialNumber!],
    query: { enabled: !!serialNumber },
  });

  const subscription = parseSubscription(subscriptionRaw);

  const { writeContractAsync: buyListing } = useScaffoldWriteContract({
    contractName: "SubscriptionSalesMarketplace",
  });

  const { writeContractAsync: placeBid } = useScaffoldWriteContract({
    contractName: "SubscriptionSalesMarketplace",
  });

  const { writeContractAsync: settleAuction } = useScaffoldWriteContract({
    contractName: "SubscriptionSalesMarketplace",
  });

  const { data: bidEvents } = useScaffoldEventHistory({
    contractName: "SubscriptionSalesMarketplace",
    eventName: "BidPlaced",
    watch: false,
  });

  const bidHistory = useMemo(() => {
    if (!bidEvents || !listingData) return [];

    return bidEvents
      .filter(event => event.args?.listingId?.toString() === listingId.toString())
      .map(event => ({
        bidder: event.args.bidder as string,
        amount: event.args.amount as bigint,
        timestamp: event.blockNumber,
      }))
      .sort((a, b) => Number(b.amount - a.amount));
  }, [bidEvents, listingId, listingData]);

  const isAuction = listingData ? Number(listingData.listingType) === ListingType.Auction : false;
  const isActive = listingData && Number(listingData.status) === ListingStatus.Active;
  const isSeller = listingData?.seller?.toLowerCase() === connectedAddress?.toLowerCase();
  const hasNoBids = listingData?.highestBidder === ZERO_ADDRESS;
  const auctionEndTime = listingData?.auctionEndTime ?? 0n;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const auctionEnded = isAuction && auctionEndTime <= now;
  const isHighestBidder = listingData?.highestBidder?.toLowerCase() === connectedAddress?.toLowerCase();

  useEffect(() => {
    if (!isAuction || !listingData) return;

    const updateTimer = () => {
      setTimeRemaining(formatTimeRemaining(auctionEndTime));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isAuction, listingData, auctionEndTime]);

  const handleBuy = async () => {
    if (!listingData) return;

    setIsProcessing(true);
    try {
      const priceWei = tinybarsToWei(listingData.price);
      await buyListing({
        functionName: "buy",
        args: [listingId],
        value: priceWei,
        gas: GAS_LIMITS.BUY || 500000n,
      });

      router.push("/my-subscriptions");
    } catch (error) {
      console.error("Purchase failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBid = async () => {
    if (!listingData || !bidAmount) return;

    setIsProcessing(true);
    try {
      const bidTinybars = hbarToTinybars(parseFloat(bidAmount));
      const bidWei = tinybarsToWei(bidTinybars);

      await placeBid({
        functionName: "bid",
        args: [listingId],
        value: bidWei,
        gas: GAS_LIMITS.BID || 500000n,
      });

      setBidAmount("");
    } catch (error) {
      console.error("Bid failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSettle = async () => {
    setIsProcessing(true);
    try {
      await settleAuction({
        functionName: "settleAuction",
        args: [listingId],
        gas: GAS_LIMITS.SETTLE || 500000n,
      });

      router.push("/my-subscriptions");
    } catch (error) {
      console.error("Settlement failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoadingListing) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-base-300 rounded mb-4"></div>
          <div className="h-64 bg-base-300 rounded"></div>
        </div>
      </div>
    );
  }

  if (!listingData || listingData.id === 0n) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Listing Not Found</h1>
        <Link href="/sales" className="btn btn-primary">
          Back to Sales
        </Link>
      </div>
    );
  }

  const statusLabels: Record<number, string> = {
    [ListingStatus.Active]: "Active",
    [ListingStatus.Sold]: "Sold",
    [ListingStatus.Cancelled]: "Cancelled",
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/sales" className="btn btn-ghost btn-sm mb-6">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Sales
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card bg-base-100 border border-base-300 shadow-md rounded-xl">
            <div className="card-body">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">
                    {subscription ? subscription.provider : `NFT #${listingData.serialNumber.toString()}`}
                  </h1>
                  {subscription && <p className="text-base-content/70">{subscription.serviceTier}</p>}
                </div>
                <div className="flex gap-2">
                  <span className={`badge badge-lg ${isAuction ? "badge-info" : "badge-primary"}`}>
                    {isAuction ? "Auction" : "Fixed Price"}
                  </span>
                  <span
                    className={`badge badge-lg ${
                      Number(listingData.status) === ListingStatus.Active
                        ? "badge-success"
                        : Number(listingData.status) === ListingStatus.Sold
                          ? "badge-warning"
                          : "badge-error"
                    }`}
                  >
                    {statusLabels[Number(listingData.status)]}
                  </span>
                </div>
              </div>

              <div className="divider"></div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <TagIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-base-content/60">{isAuction ? "Reserve Price" : "Asking Price"}</p>
                    <HbarAmount tinybars={listingData.price} className="font-semibold text-lg" />
                  </div>
                </div>

                {isAuction && (
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <ClockIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-base-content/60">Time Remaining</p>
                      <p className={`font-semibold text-lg ${auctionEnded ? "text-error" : ""}`}>
                        {timeRemaining || "Loading..."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <UserIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-base-content/60">Seller</p>
                    <AddressDisplay address={listingData.seller} />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <TicketIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-base-content/60">NFT Serial</p>
                    <p className="font-semibold">#{listingData.serialNumber.toString()}</p>
                  </div>
                </div>
              </div>

              {isAuction && !hasNoBids && (
                <div className="bg-success/10 border border-success/30 rounded-lg p-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-success">Current Highest Bid:</span>
                    <HbarAmount tinybars={listingData.highestBid} className="font-bold text-lg" />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-base-content/60 text-sm">Bidder:</span>
                    <AddressDisplay address={listingData.highestBidder} size="sm" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {subscription && (
            <div className="card bg-base-100 border border-base-300 shadow-md rounded-xl">
              <div className="card-body">
                <h2 className="card-title">Subscription Details</h2>
                <div className="divider my-2"></div>
                <div className="space-y-2">
                  <p>
                    <span className="text-base-content/60">Provider:</span>{" "}
                    <span className="font-semibold">{subscription.provider}</span>
                  </p>
                  <p>
                    <span className="text-base-content/60">Tier:</span>{" "}
                    <span className="font-semibold">{subscription.serviceTier}</span>
                  </p>
                  <p>
                    <span className="text-base-content/60">Valid Period:</span>{" "}
                    <DateRangeDisplay
                      start={listingData.effectiveStartDate}
                      end={subscription.endDate}
                      className="font-semibold"
                    />
                  </p>
                </div>
              </div>
            </div>
          )}

          {isAuction && bidHistory.length > 0 && (
            <div className="card bg-base-100 border border-base-300 shadow-md rounded-xl">
              <div className="card-body">
                <h2 className="card-title">Bid History</h2>
                <div className="divider my-2"></div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {bidHistory.map((bid, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-base-200 rounded-lg">
                      <AddressDisplay address={bid.bidder} size="sm" />
                      <HbarAmount tinybars={bid.amount} className="font-semibold" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="card bg-base-100 border border-base-300 shadow-md rounded-xl sticky top-4">
            <div className="card-body">
              <h2 className="card-title">{isAuction ? "Place a Bid" : "Buy Now"}</h2>

              {!connectedAddress ? (
                <div className="alert alert-warning">
                  <span>Connect your wallet to {isAuction ? "bid on" : "buy"} this listing</span>
                </div>
              ) : isSeller ? (
                <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-4">
                  <span>This is your listing</span>
                </div>
              ) : !isActive ? (
                <div className="alert alert-error">
                  <span>This listing is no longer available</span>
                </div>
              ) : isAuction && auctionEnded ? (
                <div className="space-y-4">
                  <div className="alert alert-info">
                    <span>This auction has ended</span>
                  </div>
                  {(isHighestBidder || isSeller) && (
                    <button className="btn btn-primary w-full" onClick={handleSettle} disabled={isProcessing}>
                      {isProcessing ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Settling...
                        </>
                      ) : (
                        "Settle Auction"
                      )}
                    </button>
                  )}
                </div>
              ) : isAuction ? (
                <div className="space-y-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Your Bid (HBAR)</span>
                      {minimumBid && <span className="label-text-alt">Min: {formatHbar(minimumBid)} HBAR</span>}
                    </label>
                    <input
                      type="number"
                      className="input input-bordered w-full"
                      value={bidAmount}
                      onChange={e => setBidAmount(e.target.value)}
                      placeholder={minimumBid ? formatHbar(minimumBid) : "0"}
                      step="0.01"
                      min="0"
                    />
                  </div>

                  {isHighestBidder && (
                    <div className="bg-success/10 border border-success/30 text-success rounded-lg p-3 text-sm">
                      You are currently the highest bidder!
                    </div>
                  )}

                  <button
                    className="btn btn-primary w-full"
                    onClick={handleBid}
                    disabled={isProcessing || !bidAmount || parseFloat(bidAmount) <= 0}
                  >
                    {isProcessing ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Placing Bid...
                      </>
                    ) : (
                      `Place Bid${bidAmount ? ` for ${bidAmount} HBAR` : ""}`
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-base-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-base-content/60">Price</span>
                      <HbarAmount tinybars={listingData.price} className="font-bold text-xl" />
                    </div>
                    <div className="text-xs text-base-content/50 mt-2">+ 5% provider fee + 5% marketplace fee</div>
                  </div>

                  <button className="btn btn-primary w-full" onClick={handleBuy} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Processing...
                      </>
                    ) : (
                      `Buy for ${formatHbar(listingData.price)} HBAR`
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
