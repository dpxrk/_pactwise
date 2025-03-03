"use client";

import { useState, useEffect } from "react";
import { 
  Check, 
  AlertCircle, 
  Calendar, 
  FileText, 
  Tag, 
  Briefcase, 
  User, 
  DollarSign,
  ArrowRight,
  Plus,
  X
} from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Alert, 
  AlertDescription, 
  AlertTitle 
} from "@/components/ui/alert";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

// Modal-based NewContract component
export const NewContractModal = ({ isOpen, onClose, onSuccess }) => {
  // State variables
  const [vendorName, setVendorName] = useState("");
  const [vendorExists, setVendorExists] = useState(null);
  const [vendorSearchPerformed, setVendorSearchPerformed] = useState(false);
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValid, setFormValid] = useState(false);
  
  // Reset form when modal is opened/closed
  useEffect(() => {
    if (isOpen) {
      // If modal is opened, keep current state
    } else {
      // Reset form when modal is closed
      setVendorName("");
      setVendorExists(null);
      setVendorSearchPerformed(false);
      setStartDate(null);
      setEndDate(null);
      setFormData({
        contractName: "",
        contractType: "",
        contractValue: "",
        contractCategory: "",
        contractOwner: "",
        contractDescription: ""
      });
    }
  }, [isOpen]);
  
  // Mock contract categories for dropdown
  const contractCategories = [
    "SaaS Services",
    "Consulting",
    "Hardware",
    "Professional Services",
    "Marketing & Advertising",
    "Legal Services",
    "Maintenance & Support",
    "Content & Media",
  ];
  
  // Form data
  const [formData, setFormData] = useState({
    contractName: "",
    contractType: "",
    contractValue: "",
    contractCategory: "",
    contractOwner: "",
    contractDescription: "",
  });
  
  // Check if vendor exists (simulated API call)
  const checkVendorExists = () => {
    if (!vendorName.trim()) return;
    
    setVendorSearchPerformed(true);
    // In a real app, this would be an API call to check the vendor
    setTimeout(() => {
      // Simulate vendor check - in this case we'll say a vendor named "Acme" exists
      const exists = vendorName.toLowerCase() === "acme";
      setVendorExists(exists);
    }, 600);
  };
  
  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Create new vendor
  const handleCreateVendor = () => {
    // In a real app, this would make an API call to create the vendor
    // For demo purposes, just closing the dialog and setting vendor as existing
    setShowVendorDialog(false);
    setVendorExists(true);
  };
  
  // Redirect to vendor creation page
  const goToVendorCreation = () => {
    // Open the vendor creation dialog
    setShowVendorDialog(true);
  };
  
  // Submit the contract form
  const handleSubmitContract = () => {
    if (!formValid) return;
    
    setIsSubmitting(true);
    
    // Simulate submission delay
    setTimeout(() => {
      // Would be an API call in a real app
      console.log("Submitting contract", {
        ...formData,
        vendorName,
        startDate,
        endDate
      });
      
      setIsSubmitting(false);

      // Notify parent component of success and close modal
      if (onSuccess) {
        onSuccess({
          ...formData,
          vendorName,
          startDate,
          endDate
        });
      }
      if (onClose) {
        onClose();
      }
    }, 1000);
  };
  
  // Check if the form is valid
  useEffect(() => {
    const isValid = 
      vendorExists && 
      formData.contractName && 
      formData.contractType && 
      formData.contractValue && 
      formData.contractCategory && 
      formData.contractOwner && 
      startDate && 
      endDate;
    
    setFormValid(isValid);
  }, [vendorExists, formData, startDate, endDate]);
  
  // If modal is not open, don't render anything
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-primary/20 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-auto">
        <Card className="border-gold/10 bg-white/90 backdrop-blur-sm shadow-luxury">
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-xl text-primary font-serif">Create New Contract</CardTitle>
                <CardDescription>
                  Enter the contract information below. All fields are required.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </CardHeader>
            <div className="px-6">
              <div className="h-px w-full bg-gradient-to-r from-gold/10 via-gold/30 to-gold/10"></div>
            </div>
          </div>
          
          <CardContent className="space-y-8 pt-4">
            {/* Vendor Verification Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-primary">Vendor Information</h3>
              <p className="text-sm text-muted-foreground">
                Before creating a new contract, please verify that the vendor exists in your system.
              </p>
              
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label htmlFor="vendorName" className="text-sm font-medium mb-2 block">
                    Vendor Name
                  </Label>
                  <Input
                    id="vendorName"
                    placeholder="Enter vendor name"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="border-gold/20 focus:border-gold focus:ring-gold/30"
                  />
                </div>
                <Button 
                  onClick={checkVendorExists}
                  className="bg-primary hover:bg-primary/90"
                >
                  Verify Vendor
                </Button>
              </div>
              
              {/* Vendor verification results */}
              {vendorSearchPerformed && (
                <div className="mt-4">
                  {vendorExists === null ? (
                    <Alert className="bg-gold/5 border-gold/20">
                      <AlertCircle className="h-4 w-4 text-gold" />
                      <AlertTitle className="text-primary">Checking vendor...</AlertTitle>
                    </Alert>
                  ) : vendorExists ? (
                    <Alert className="bg-green-50 border-green-200">
                      <Check className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-800">Vendor found</AlertTitle>
                      <AlertDescription className="text-green-700">
                        "{vendorName}" exists in your vendor database. You can proceed with creating the contract.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-800">Vendor not found</AlertTitle>
                      <AlertDescription className="text-amber-700">
                        "{vendorName}" does not exist in your vendor database. You need to create this vendor first.
                        <Button 
                          variant="link" 
                          className="text-amber-900 font-medium p-0 h-auto ml-1"
                          onClick={goToVendorCreation}
                        >
                          Create Vendor
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
            
            {/* Contract Form - Only shown if vendor exists */}
            {vendorExists && (
              <div className="space-y-6 pt-4 border-t border-gold/10">
                <h3 className="text-lg font-medium text-primary">Contract Details</h3>
                
                {/* Basic contract info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="contractName" className="text-sm font-medium">
                      Contract Name
                    </Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="contractName"
                        name="contractName"
                        placeholder="Enter contract name"
                        className="pl-10 border-gold/20"
                        value={formData.contractName}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="contractType" className="text-sm font-medium">
                      Contract Type
                    </Label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                      <Select 
                        onValueChange={(value) => 
                          setFormData(prev => ({ ...prev, contractType: value }))
                        }
                      >
                        <SelectTrigger className="pl-10 border-gold/20">
                          <SelectValue placeholder="Select contract type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="msa">Master Service Agreement</SelectItem>
                          <SelectItem value="sow">Statement of Work</SelectItem>
                          <SelectItem value="nda">Non-Disclosure Agreement</SelectItem>
                          <SelectItem value="licensing">Licensing Agreement</SelectItem>
                          <SelectItem value="subscription">Subscription</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="contractValue" className="text-sm font-medium">
                      Contract Value
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="contractValue"
                        name="contractValue"
                        placeholder="Enter contract value"
                        className="pl-10 border-gold/20"
                        value={formData.contractValue}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="contractCategory" className="text-sm font-medium">
                      Contract Category
                    </Label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                      <Select 
                        onValueChange={(value) => 
                          setFormData(prev => ({ ...prev, contractCategory: value }))
                        }
                      >
                        <SelectTrigger className="pl-10 border-gold/20">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {contractCategories.map((category) => (
                            <SelectItem key={category} value={category.toLowerCase().replace(/\s+/g, '-')}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                {/* Contract dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Start Date
                    </Label>
                    <div className="relative">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal border-gold/20 pl-10"
                          >
                            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            {startDate ? (
                              format(startDate, "PPP")
                            ) : (
                              <span className="text-muted-foreground">Select start date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      End Date
                    </Label>
                    <div className="relative">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal border-gold/20 pl-10"
                          >
                            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            {endDate ? (
                              format(endDate, "PPP")
                            ) : (
                              <span className="text-muted-foreground">Select end date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                            disabled={(date) => date < new Date() || (startDate && date < startDate)}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
                
                {/* Contract owner */}
                <div className="space-y-2">
                  <Label htmlFor="contractOwner" className="text-sm font-medium">
                    Contract Owner
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="contractOwner"
                      name="contractOwner"
                      placeholder="Enter contract owner name"
                      className="pl-10 border-gold/20"
                      value={formData.contractOwner}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                {/* Contract description */}
                <div className="space-y-2">
                  <Label htmlFor="contractDescription" className="text-sm font-medium">
                    Description
                  </Label>
                  <Textarea
                    id="contractDescription"
                    name="contractDescription"
                    placeholder="Enter contract description and key terms"
                    className="min-h-24 border-gold/20"
                    value={formData.contractDescription}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex justify-between border-t border-gold/10 pt-6">
            <Button 
              variant="outline" 
              className="border-gold/50 text-primary hover:bg-gold/5"
              onClick={onClose}
            >
              Cancel
            </Button>
            
            <Button 
              disabled={!formValid || isSubmitting}
              className="bg-primary hover:bg-primary/90 text-white group"
              onClick={handleSubmitContract}
            >
              {isSubmitting ? "Creating..." : "Create Contract"}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      {/* Dialog for creating a new vendor */}
      <Dialog open={showVendorDialog} onOpenChange={setShowVendorDialog}>
        <DialogContent className="bg-white border-gold/10 shadow-luxury">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif text-primary">Create New Vendor</DialogTitle>
            <DialogDescription>
              Add this vendor to your database before creating a contract.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newVendorName" className="text-sm font-medium">
                Vendor Name
              </Label>
              <Input
                id="newVendorName"
                defaultValue={vendorName}
                className="border-gold/20"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="vendorCategory" className="text-sm font-medium">
                Vendor Category
              </Label>
              <Select defaultValue="software">
                <SelectTrigger className="border-gold/20">
                  <SelectValue placeholder="Select vendor category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="software">Software & Technology</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="marketing">Marketing & Advertising</SelectItem>
                  <SelectItem value="legal">Legal Services</SelectItem>
                  <SelectItem value="hardware">Hardware Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="relationshipStart" className="text-sm font-medium">
                Relationship Start Date
              </Label>
              <div className="relative">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal border-gold/20"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      <span className="text-muted-foreground">Select date</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="vendorId" className="text-sm font-medium">
                Vendor ID (Optional)
              </Label>
              <Input
                id="vendorId"
                placeholder="Enter external vendor ID if available"
                className="border-gold/20"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              className="border-gold/50 text-primary hover:bg-gold/5"
              onClick={() => setShowVendorDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateVendor}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

