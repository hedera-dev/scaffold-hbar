"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";
import { useDeployedContractInfo } from "~~/hooks/scaffold-hbar";
import { GAS_LIMITS, formatDate, hbarToTinybars, parseSubscription } from "~~/utils/hedera";

const ERC721_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "getApproved",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "isApprovedForAll",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

interface CreateSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  serialNumber: bigint;
}

export const CreateSaleModal = ({ isOpen, onClose, serialNumber }: CreateSaleModalProps) => {
  const router = useRouter();
  const { address: connectedAddress } = useAccount();
  const [listingType, setListingType] = useState<"fixed" | "auction">("fixed");
  const [price, setPrice] = useState<string>("10");
  const [startDate, setStartDate] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string>("");
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const hasCheckedApproval = useRef(false);

  const { data: subscriptionRaw } = useScaffoldReadContract({
    contractName: "SubscriptionNFT",
    functionName: "getSubscription",
    args: [serialNumber],
    query: { enabled: !!serialNumber },
  });

  const { data: hasActiveFutureBookings } = useScaffoldReadContract({
    contractName: "SubscriptionMarketplace",
    functionName: "hasActiveFutureBookings",
    args: [serialNumber],
    query: { enabled: !!serialNumber },
  });

  // Get the actual HTS token collection address from SubscriptionNFT
  const { data: htsCollectionAddress } = useScaffoldReadContract({
    contractName: "SubscriptionNFT",
    functionName: "collectionAddress",
    query: { enabled: isOpen },
  });

  // Get the SalesMarketplace contract address
  const { data: salesMarketplaceInfo } = useDeployedContractInfo({ contractName: "SubscriptionSalesMarketplace" });
  const salesMarketplaceAddress = salesMarketplaceInfo?.address;

  // Check if already approved for the specific token
  const { data: approvedAddress, refetch: refetchApproval } = useReadContract({
    address: htsCollectionAddress as `0x${string}`,
    abi: ERC721_ABI,
    functionName: "getApproved",
    args: [serialNumber],
    query: { enabled: !!htsCollectionAddress && !!serialNumber && isOpen },
  });

  // Check if approved for all
  const { data: isApprovedForAll } = useReadContract({
    address: htsCollectionAddress as `0x${string}`,
    abi: ERC721_ABI,
    functionName: "isApprovedForAll",
    args: [connectedAddress as `0x${string}`, salesMarketplaceAddress as `0x${string}`],
    query: { enabled: !!htsCollectionAddress && !!connectedAddress && !!salesMarketplaceAddress && isOpen },
  });

  const isApproved =
    (approvedAddress &&
      salesMarketplaceAddress &&
      approvedAddress.toLowerCase() === salesMarketplaceAddress.toLowerCase()) ||
    isApprovedForAll === true;

  const subscription = parseSubscription(subscriptionRaw);

  // Calculate date constraints for the start date picker (all in UTC)
  // Get current UTC date at midnight
  const nowUtc = new Date();
  const todayUtcStr = `${nowUtc.getUTCFullYear()}-${String(nowUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(nowUtc.getUTCDate()).padStart(2, "0")}`;

  const subscriptionStartTimestamp = subscription?.startDate ? Number(subscription.startDate) : 0;
  const subscriptionStartDate = new Date(subscriptionStartTimestamp * 1000);
  const subscriptionStartStr = `${subscriptionStartDate.getUTCFullYear()}-${String(subscriptionStartDate.getUTCMonth() + 1).padStart(2, "0")}-${String(subscriptionStartDate.getUTCDate()).padStart(2, "0")}`;

  const subscriptionEndTimestamp = subscription?.endDate ? Number(subscription.endDate) : 0;
  const subscriptionEndDate = subscriptionEndTimestamp ? new Date(subscriptionEndTimestamp * 1000) : null;
  const subscriptionEndStr = subscriptionEndDate
    ? `${subscriptionEndDate.getUTCFullYear()}-${String(subscriptionEndDate.getUTCMonth() + 1).padStart(2, "0")}-${String(subscriptionEndDate.getUTCDate()).padStart(2, "0")}`
    : "";

  // Min date is max of today and subscription start
  const minDateStr = todayUtcStr > subscriptionStartStr ? todayUtcStr : subscriptionStartStr;

  const { writeContractAsync: createListing } = useScaffoldWriteContract({
    contractName: "SubscriptionSalesMarketplace",
  });

  // Wagmi write for approve
  const { writeContractAsync: approveNFT } = useWriteContract();

  // Wait for approval transaction
  const { isSuccess: isApprovalConfirmed, isError: isApprovalFailed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  // Refetch approval status after confirmation
  useEffect(() => {
    if (isApprovalConfirmed && approveTxHash) {
      refetchApproval();
      setIsApproving(false);
      setApproveTxHash(undefined);
    }
  }, [isApprovalConfirmed, approveTxHash, refetchApproval]);

  // Handle approval failure
  useEffect(() => {
    if (isApprovalFailed && approveTxHash) {
      setError("Approval transaction failed");
      setIsApproving(false);
      setApproveTxHash(undefined);
    }
  }, [isApprovalFailed, approveTxHash]);

  useEffect(() => {
    if (isOpen) {
      hasCheckedApproval.current = false;
      setError("");
      setPrice("10");
      setListingType("fixed");
      setStartDate(minDateStr);
      setApproveTxHash(undefined);
      setIsApproving(false);
    }
  }, [isOpen, serialNumber, minDateStr]);

  const handleApprove = async () => {
    if (!htsCollectionAddress || !salesMarketplaceAddress) {
      setError("Contract addresses not loaded yet");
      return;
    }

    setIsApproving(true);
    setError("");
    setApproveTxHash(undefined);

    try {
      const hash = await approveNFT({
        address: htsCollectionAddress as `0x${string}`,
        abi: ERC721_ABI,
        functionName: "approve",
        args: [salesMarketplaceAddress as `0x${string}`, serialNumber],
        gas: GAS_LIMITS.APPROVE_NFT,
      });
      setApproveTxHash(hash);
    } catch (err: unknown) {
      console.error("Failed to approve NFT:", err);
      setError(err instanceof Error ? err.message : "Failed to approve NFT for transfer");
      setIsApproving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!price) {
      setError("Please enter a price");
      return;
    }

    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      setError("Please enter a valid price");
      return;
    }

    if (!startDate) {
      setError("Please select a start date");
      return;
    }

    if (hasActiveFutureBookings) {
      setError("Cannot list for sale: this subscription has active future bookings");
      return;
    }

    if (!isApproved) {
      setError("Please approve the marketplace to transfer your NFT first");
      return;
    }

    setIsCreating(true);

    try {
      const priceTinybars = hbarToTinybars(priceValue);

      // Convert date string to Unix timestamp
      // If selected date is today, use current timestamp + 5 min buffer to ensure it's in the future
      const selectedDateUtcMidnight = Math.floor(new Date(startDate + "T00:00:00Z").getTime() / 1000);
      const nowTimestamp = Math.floor(Date.now() / 1000);
      const bufferSeconds = 5 * 60; // 5 minutes buffer

      // If the selected date's midnight is in the past (i.e., today was selected), use current time + buffer
      const effectiveStartTimestamp = BigInt(
        selectedDateUtcMidnight < nowTimestamp ? nowTimestamp + bufferSeconds : selectedDateUtcMidnight,
      );

      if (listingType === "auction") {
        await createListing({
          functionName: "createAuction",
          args: [serialNumber, priceTinybars, effectiveStartTimestamp],
          gas: GAS_LIMITS.CREATE_SALE_LISTING,
        });
      } else {
        await createListing({
          functionName: "createFixedPriceListing",
          args: [serialNumber, priceTinybars, effectiveStartTimestamp],
          gas: GAS_LIMITS.CREATE_SALE_LISTING,
        });
      }

      onClose();
      router.push("/sales");
    } catch (err: unknown) {
      console.error("Failed to create sale listing:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to create listing";
      if (errorMsg.includes("NotApprovedForTransfer")) {
        setError("Please approve the marketplace to transfer your NFT first");
      } else if (errorMsg.includes("InvalidEffectiveStartDate")) {
        setError("Invalid start date. Must be between today and subscription end date.");
      } else {
        setError(errorMsg);
      }
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  const isBlocked = hasActiveFutureBookings;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={onClose}>
          <XMarkIcon className="h-5 w-5" />
        </button>

        <h3 className="font-bold text-lg mb-4">List for Sale</h3>

        {subscription && (
          <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-4 mb-4">
            <p className="font-semibold">{subscription.provider}</p>
            <p className="text-sm opacity-80">{subscription.serviceTier}</p>
            <p className="text-sm opacity-80">
              Valid: {formatDate(subscription.startDate)} - {formatDate(subscription.endDate)}
            </p>
          </div>
        )}

        {isBlocked && (
          <div className="alert alert-warning mb-4">
            <span>
              This subscription has active future bookings. Cancel or wait for bookings to complete before listing for
              sale.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Listing Type</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="listingType"
                  className="radio radio-primary"
                  checked={listingType === "fixed"}
                  onChange={() => setListingType("fixed")}
                  disabled={isBlocked}
                />
                <span>Fixed Price</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="listingType"
                  className="radio radio-primary"
                  checked={listingType === "auction"}
                  onChange={() => setListingType("auction")}
                  disabled={isBlocked}
                />
                <span>Auction (3 days)</span>
              </label>
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">
                {listingType === "fixed" ? "Asking Price (HBAR)" : "Reserve Price (HBAR)"}
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input input-bordered w-full"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="10.00"
              required
              disabled={isBlocked}
            />
            <label className="label">
              <span className="label-text-alt text-base-content/60">
                {listingType === "fixed" ? "Buyer pays this exact amount" : "Minimum bid required to win the auction"}
              </span>
            </label>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Effective Start Date</span>
            </label>
            <input
              type="date"
              className="input input-bordered w-full"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              min={minDateStr}
              max={subscriptionEndStr}
              required
              disabled={isBlocked}
            />
            <label className="label">
              <span className="label-text-alt text-base-content/60">
                Buyer can use the subscription from this date onwards
              </span>
            </label>
          </div>

          <div className="bg-base-200 rounded-lg p-3 text-sm">
            <p className="font-semibold mb-1">Fee Breakdown:</p>
            <ul className="list-disc list-inside text-base-content/70">
              <li>5% Provider Royalty (goes to original provider)</li>
              <li>5% Marketplace Fee</li>
              <li>90% goes to you (the seller)</li>
            </ul>
          </div>

          {/* Approval Status */}
          {!isBlocked && (
            <div
              className={`rounded-lg p-3 text-sm ${isApproved ? "bg-success/20 border border-success/30" : "bg-warning/20 border border-warning/30"}`}
            >
              {isApproved ? (
                <div className="flex items-center gap-2 text-success">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Marketplace approved to transfer your NFT</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Approval required before listing</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-warning btn-sm"
                    onClick={handleApprove}
                    disabled={isApproving || !htsCollectionAddress || !salesMarketplaceAddress}
                  >
                    {isApproving ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Approving...
                      </>
                    ) : (
                      "Approve Marketplace"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isCreating || isApproving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isCreating || isBlocked || !isApproved}>
              {isCreating ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Creating...
                </>
              ) : listingType === "fixed" ? (
                "List for Sale"
              ) : (
                "Start Auction"
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop bg-base-300/50" onClick={onClose}></div>
    </div>
  );
};
