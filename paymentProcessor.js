// paymentProcessor.js
const crypto = require('crypto');

// Payment processor configuration
const PAYMENT_CONFIG = {
  // Pricing tiers
  pricing: {
    single_affidavit: 49.00,
    family_law_bundle: 149.00,
    monthly_unlimited: 29.99
  },
  
  // State-specific fees (if any)
  stateFees: {
    TX: 0,
    UT: 0,
    AZ: 0
  }
};

// Generic payment processor interface
class PaymentProcessor {
  constructor(config) {
    this.gateway = config.gateway; // 'stripe', 'square', 'authorize', etc.
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.environment = config.environment || 'sandbox'; // 'sandbox' or 'production'
    
    // Initialize specific gateway
    this.initializeGateway();
  }

  initializeGateway() {
    switch(this.gateway) {
      case 'stripe':
        this.processor = require('stripe')(this.apiKey);
        break;
      case 'square':
        const { Client, Environment } = require('square');
        this.processor = new Client({
          accessToken: this.apiKey,
          environment: this.environment === 'production' ? Environment.Production : Environment.Sandbox
        });
        break;
      case 'authorize':
        const ApiContracts = require('authorizenet').APIContracts;
        const ApiControllers = require('authorizenet').APIControllers;
        const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
        merchantAuthenticationType.setName(this.apiKey);
        merchantAuthenticationType.setTransactionKey(this.apiSecret);
        this.processor = { merchantAuth: merchantAuthenticationType, controllers: ApiControllers };
        break;
      default:
        // Generic gateway interface
        this.processor = null;
    }
  }

  // Create payment intent/token
  async createPaymentIntent(amount, currency = 'USD', metadata = {}) {
    const orderReference = this.generateOrderReference();
    
    try {
      switch(this.gateway) {
        case 'stripe':
          return await this.createStripeIntent(amount, currency, metadata, orderReference);
        case 'square':
          return await this.createSquarePayment(amount, currency, metadata, orderReference);
        case 'authorize':
          return await this.createAuthorizeTransaction(amount, currency, metadata, orderReference);
        default:
          return await this.createGenericPayment(amount, currency, metadata, orderReference);
      }
    } catch (error) {
      console.error('Payment intent creation failed:', error);
      throw new Error('Failed to initialize payment');
    }
  }

  // Stripe implementation
  async createStripeIntent(amount, currency, metadata, orderReference) {
    const paymentIntent = await this.processor.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: {
        ...metadata,
        order_reference: orderReference
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderReference
    };
  }

  // Square implementation
  async createSquarePayment(amount, currency, metadata, orderReference) {
    const { paymentsApi } = this.processor;
    const { result } = await paymentsApi.createPayment({
      sourceId: metadata.nonce, // Card nonce from Square payment form
      amountMoney: {
        amount: Math.round(amount * 100),
        currency
      },
      referenceId: orderReference,
      note: metadata.description || 'Affidavit Document Preparation'
    });

    return {
      success: true,
      payment: result.payment,
      orderReference
    };
  }

  // Authorize.Net implementation
  async createAuthorizeTransaction(amount, currency, metadata, orderReference) {
    const { merchantAuth, controllers } = this.processor;
    
    const transactionRequestType = new ApiContracts.TransactionRequestType();
    transactionRequestType.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequestType.setAmount(amount);
    
    // Set payment info (would come from frontend)
    const opaqueData = new ApiContracts.OpaqueDataType();
    opaqueData.setDataDescriptor(metadata.dataDescriptor);
    opaqueData.setDataValue(metadata.dataValue);
    
    const paymentType = new ApiContracts.PaymentType();
    paymentType.setOpaqueData(opaqueData);
    transactionRequestType.setPayment(paymentType);

    const createRequest = new ApiContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuth);
    createRequest.setTransactionRequest(transactionRequestType);

    return new Promise((resolve, reject) => {
      const ctrl = new controllers.CreateTransactionController(createRequest.getJSON());
      ctrl.execute(() => {
        const response = new ApiContracts.CreateTransactionResponse(ctrl.getResponse());
        if (response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
          resolve({
            success: true,
            transactionId: response.getTransactionResponse().getTransId(),
            orderReference
          });
        } else {
          reject(new Error('Transaction failed'));
        }
      });
    });
  }

  // Generic payment gateway implementation
  async createGenericPayment(amount, currency, metadata, orderReference) {
    // This is where you'd implement your specific gateway's API
    // Example structure:
    const payload = {
      amount: amount,
      currency: currency,
      reference: orderReference,
      description: metadata.description || 'Legal Document Preparation',
      customer: {
        email: metadata.email,
        name: metadata.customerName
      },
      // Add any gateway-specific fields here
      ...metadata.gatewaySpecific
    };

    // Make API call to your gateway
    const response = await fetch(`${this.getGatewayUrl()}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Payment failed');
    }

    return {
      success: true,
      paymentId: result.id || result.payment_id,
      orderReference,
      // Return any additional data needed by frontend
      ...result
    };
  }

  // Process payment completion
  async confirmPayment(paymentId, paymentDetails = {}) {
    try {
      switch(this.gateway) {
        case 'stripe':
          // Stripe confirms on frontend, just verify here
          const intent = await this.processor.paymentIntents.retrieve(paymentId);
          return {
            success: intent.status === 'succeeded',
            charge: intent.latest_charge
          };
        
        case 'square':
          // Square payment already processed in createPayment
          return { success: true, paymentId };
        
        case 'authorize':
          // Authorize.Net captures immediately in our setup
          return { success: true, transactionId: paymentId };
        
        default:
          // Generic confirmation
          return await this.confirmGenericPayment(paymentId, paymentDetails);
      }
    } catch (error) {
      console.error('Payment confirmation failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Generic payment confirmation
  async confirmGenericPayment(paymentId, details) {
    const response = await fetch(`${this.getGatewayUrl()}/payments/${paymentId}/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(details)
    });

    const result = await response.json();
    return {
      success: response.ok && result.status === 'completed',
      ...result
    };
  }

  // Generate unique order reference
  generateOrderReference() {
    const timestamp = Date.now().toString(36);
    const randomStr = crypto.randomBytes(4).toString('hex');
    return `AFF-${timestamp}-${randomStr}`.toUpperCase();
  }

  // Get gateway API URL
  getGatewayUrl() {
    // Add your gateway's API URLs here
    const urls = {
      production: {
        // Examples:
        // 'mypaymentgateway': 'https://api.mypaymentgateway.com/v1',
        // 'customgateway': 'https://payments.customgateway.com/api',
      },
      sandbox: {
        // Examples:
        // 'mypaymentgateway': 'https://sandbox.mypaymentgateway.com/v1',
        // 'customgateway': 'https://test-payments.customgateway.com/api',
      }
    };

    return urls[this.environment]?.[this.gateway] || 'https://api.payment-gateway.com';
  }

  // Create checkout session with all details
  async createCheckoutSession(customerData, documentType) {
    const amount = PAYMENT_CONFIG.pricing[documentType] || PAYMENT_CONFIG.pricing.single_affidavit;
    const stateFee = PAYMENT_CONFIG.stateFees[customerData.state] || 0;
    const totalAmount = amount + stateFee;

    const sessionData = {
      amount: totalAmount,
      currency: 'USD',
      metadata: {
        customerName: customerData.name,
        email: customerData.email,
        state: customerData.state,
        documentType: documentType,
        caseNumber: customerData.caseNumber,
        description: `${documentType.replace('_', ' ').toUpperCase()} - ${customerData.state}`
      }
    };

    const paymentIntent = await this.createPaymentIntent(
      sessionData.amount,
      sessionData.currency,
      sessionData.metadata
    );

    return {
      ...paymentIntent,
      amount: totalAmount,
      breakdown: {
        base: amount,
        stateFee: stateFee,
        total: totalAmount
      }
    };
  }
}

// Express routes for payment handling
const createPaymentRoutes = (app, paymentProcessor) => {
  // Create payment intent
  app.post('/api/payment/create-intent', async (req, res) => {
    try {
      const { customerData, documentType } = req.body;
      
      if (!customerData || !documentType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required data'
        });
      }

      const session = await paymentProcessor.createCheckoutSession(customerData, documentType);
      
      res.json({
        success: true,
        ...session
      });
    } catch (error) {
      console.error('Payment creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Payment initialization failed'
      });
    }
  });

  // Confirm payment
  app.post('/api/payment/confirm', async (req, res) => {
    try {
      const { paymentId, paymentDetails } = req.body;
      
      const confirmation = await paymentProcessor.confirmPayment(paymentId, paymentDetails);
      
      if (confirmation.success) {
        // Here you would:
        // 1. Update user's payment status in database
        // 2. Enable document generation
        // 3. Send confirmation email
        
        res.json({
          success: true,
          message: 'Payment confirmed',
          ...confirmation
        });
      } else {
        res.status(400).json({
          success: false,
          error: confirmation.error || 'Payment confirmation failed'
        });
      }
    } catch (error) {
      console.error('Payment confirmation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to confirm payment'
      });
    }
  });

  // Get pricing
  app.get('/api/payment/pricing', (req, res) => {
    res.json({
      success: true,
      pricing: PAYMENT_CONFIG.pricing,
      stateFees: PAYMENT_CONFIG.stateFees
    });
  });
};

module.exports = {
  PaymentProcessor,
  createPaymentRoutes,
  PAYMENT_CONFIG
};