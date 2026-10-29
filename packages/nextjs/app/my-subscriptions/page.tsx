"use client";

import { useState } from "react";
import { SubscriptionsList } from "./_components/SubscriptionsList";
import { TicketIcon } from "@heroicons/react/24/outline";
import { CreateAvailabilityModal, CreateSaleModal } from "~~/components/marketplace";

export default function MySubscriptionsPage() {
  const [selectedSerialNumber, setSelectedSerialNumber] = useState<bigint | null>(null);
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);

  const handleCreateListing = (serialNumber: bigint) => {
    setSelectedSerialNumber(serialNumber);
    setIsRentalModalOpen(true);
  };

  const handleListForSale = (serialNumber: bigint) => {
    setSelectedSerialNumber(serialNumber);
    setIsSaleModalOpen(true);
  };

  const handleCloseRentalModal = () => {
    setIsRentalModalOpen(false);
    setSelectedSerialNumber(null);
  };

  const handleCloseSaleModal = () => {
    setIsSaleModalOpen(false);
    setSelectedSerialNumber(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <TicketIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">My Subscriptions</h1>
            <p className="text-base-content/60">Manage your subscription NFTs</p>
          </div>
        </div>
        <a href="/mint" className="btn btn-primary">
          Mint New
        </a>
      </div>

      <SubscriptionsList onCreateListing={handleCreateListing} onListForSale={handleListForSale} />

      {selectedSerialNumber !== null && (
        <>
          <CreateAvailabilityModal
            isOpen={isRentalModalOpen}
            onClose={handleCloseRentalModal}
            serialNumber={selectedSerialNumber}
          />
          <CreateSaleModal
            isOpen={isSaleModalOpen}
            onClose={handleCloseSaleModal}
            serialNumber={selectedSerialNumber}
          />
        </>
      )}
    </div>
  );
}
